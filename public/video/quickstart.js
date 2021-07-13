var activeRoom;
var previewTracks;
var identity;
var roomName;
var userName;
var screenTrack;

function isFirefox() {
  var mediaSourceSupport = !!navigator.mediaDevices.getSupportedConstraints()
    .mediaSource;
  var matchData = navigator.userAgent.match(/Firefox\/(\d+)/);
  var firefoxVersion = 0;
  if (matchData && matchData[1]) {
    firefoxVersion = parseInt(matchData[1], 10);
  }
  return mediaSourceSupport && firefoxVersion >= 52;
}

function isChrome() {
  return 'chrome' in window;
}

function canScreenShare() {
  return isChrome || isFirefox;
}

function getUserScreen() {
  var extensionId = "abgifaacmhcebnnkipijgdaeghnfmodd";
  if (!canScreenShare()) {
    return;
  }
  if (isChrome()) {
    return new Promise((resolve, reject) => {
      const request = {
        sources: ['screen']
      };
      chrome.runtime.sendMessage(extensionId, request, response => {
        if (response && response.type === 'success') {
          resolve({ streamId: response.streamId });
        } else {
          reject(new Error('Could not get stream'));
        }
      });
    }).then(response => {
      return navigator.mediaDevices.getUserMedia({
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: response.streamId
          }
        }
      });
    });
  } else if (isFirefox()) {
    return navigator.mediaDevices.getUserMedia({
      video: {
        mediaSource: 'screen'
      }
    });
  }
}

function attachTracks(tracks, container) {
  tracks.forEach(function(track) {
    container.appendChild(track.attach());
  });
}

function attachParticipantTracks(participant, container) {
  var tracks = Array.from(participant.tracks.values());
  attachTracks(tracks, container);
}

function detachTracks(tracks) {
  tracks.forEach(function(track) {
    track.detach().forEach(function(detachedElement) {
      detachedElement.remove();
    });
  });
}

function detachParticipantTracks(participant) {
  var tracks = Array.from(participant.tracks.values());
  detachTracks(tracks);
}

// Check for WebRTC
if (!navigator.webkitGetUserMedia && !navigator.mozGetUserMedia) {
  alert('WebRTC is not available in your browser.');
}

// When we are about to transition away from this page, disconnect
// from the room, if joined.
window.addEventListener('beforeunload', leaveRoomIfJoined);

$.getJSON('/token', function(data) {

  identity = data.identity;

  document.getElementById('room-controls').style.display = 'block';

  // Bind button to join room
  document.getElementById('button-join').onclick = function () {
    roomName = document.getElementById('room-name').value;
    if (roomName) {
      log("Joining room '" + roomName + "'...");

      var connectOptions = { name: roomName, logLevel: 'debug' };
      if (previewTracks) {
        connectOptions.tracks = previewTracks;
      }

      Twilio.Video.connect(data.token, connectOptions).then(roomJoined, function(error) {
        log('Could not connect to Twilio: ' + error.message);
      });
    } else {
      alert('Please enter a room name.');
    }
  };

  // Bind button to leave room
  document.getElementById('button-leave').onclick = function () {
    log('Leaving room...');
    alert('Do you want to leave room: '+roomName);
    activeRoom.disconnect();
  };
  document.getElementById('screen-share').onclick = function() {
    getUserScreen().then(function(stream) {
      screenTrack = stream.getVideoTracks()[0];
      activeRoom.localParticipant.publishTrack(screenTrack);
      document.getElementById('screen-share').style.display = 'none';
      document.getElementById('stop-screen').style.display = 'inline';
    });
  };

  document.getElementById('stop-screen').onclick = function() {
      activeRoom.localParticipant.unpublishTrack(screenTrack);
      screenTrack = null;
      document.getElementById('screen-share').style.display = 'inline';
      document.getElementById('stop-screen').style.display = 'none';
  };

});

// Successfully connected!
function roomJoined(room) {
  activeRoom = room;

  document.getElementById('button-preview').style.display="none";
 // document.getElementById('screen-share').style.display = 'inline';
  // document.getElementById('mute-voice').style.display="inline";
  // document.getElementById('close-video').style.display="inline";

  log("Joined as '" + identity + "'");
  document.getElementById('button-join').style.display = 'none';
  document.getElementById('button-leave').style.display = 'inline';
  if (canScreenShare()) {
    document.getElementById('screen-share').style.display = 'inline';
  }
  // Draw local video, if not already previewing
  var previewContainer = document.getElementById('local-media');
  if (!previewContainer.querySelector('video')) {
    attachParticipantTracks(room.localParticipant, previewContainer);
  }

  room.participants.forEach(function(participant) {
    log("Already in Room: '" + participant.identity + "'");
    var previewContainer = document.getElementById('remote-media');
    attachParticipantTracks(participant, previewContainer);
  });

  // When a participant joins, draw their video on screen
  room.on('participantConnected', function(participant) {
    log("Joining: '" + participant.identity + "'");
  });

  room.on('trackAdded', function(track, participant) {
    log(participant.identity + " added track: " + track.kind);
    var previewContainer = document.getElementById('remote-media');
    attachTracks([track], previewContainer);
  });

  room.on('trackRemoved', function(track, participant) {
    log(participant.identity + " removed track: " + track.kind);
    detachTracks([track]);
  });

  // When a participant disconnects, note in log
  room.on('participantDisconnected', function(participant) {
    log("Participant '" + participant.identity + "' left the room");
    detachParticipantTracks(participant);
  });

  // When we are disconnected, stop capturing local video
  // Also remove media for all remote participants
  room.on('disconnected', function() {
    log('Left');
    detachParticipantTracks(room.localParticipant);
    room.participants.forEach(detachParticipantTracks);
    activeRoom = null;
    document.getElementById('button-join').style.display = 'inline';
    document.getElementById('button-leave').style.display = 'none';
    document.getElementById('button-preview').style.display="inline";
    document.getElementById('screen-share').style.display = 'none';
  });

  //////////////////////////////////////////CHAT/////////////////////////////////////
  
  ///////////////////////////////////////////CHAT////////////////////////////////////
}

//  Local video preview
document.getElementById('button-preview').onclick = function() {
  var localTracksPromise = previewTracks
  ? Promise.resolve(previewTracks)
  : Twilio.Video.createLocalTracks();

  localTracksPromise.then(function(tracks) {
    previewTracks = tracks;
    var previewContainer = document.getElementById('local-media');
    if (!previewContainer.querySelector('video')) {
      attachTracks(tracks, previewContainer);
    }else{
      detachTracks(tracks,previewContainer);
    }
  }, function(error) {
    console.error('Unable to access local media', error);
    log('Unable to access Camera and Microphone');
  });
};
document.getElementById("close-camera").onclick = function(){
  room.localParticipant.track.detach();
}


// Activity log
function log(message) {
  var logDiv = document.getElementById('log');
  logDiv.innerHTML += '<p>&gt;&nbsp;' + message + '</p>';
  logDiv.scrollTop = logDiv.scrollHeight;
}

function leaveRoomIfJoined() {
  if (activeRoom) {
    activeRoom.disconnect();
   
  }
}
