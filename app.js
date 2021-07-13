require('dotenv').config();

// Node/Express
const express = require('express');
const http = require('http');
const path = require('path');
const bodyParser = require('body-parser');
const router = require('./public/router');

const passport = require('passport');
const cookieSession = require('cookie-session');
const { name } = require('ejs');
require('./public/passport-setup');

// Create Express webapp
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Add body parser for Notify device registration
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(router);

app.set('views', path.join(__dirname, 'public'))
app.set('view engine','ejs')

app.use(cookieSession({
  name: 'tuto-session',
  keys: ['key1', 'key2']
}))

// Auth middleware that checks if the user is logged in
const isLoggedIn = (req, res, next) => {
  if (req.user) {
      next();
  } else {
      res.sendStatus(401);
  }
}

// Initializes passport and passport sessions
app.use(passport.initialize());
app.use(passport.session());

// Example protected and unprotected routes
app.get('/failed', (req, res) => res.send('You Failed to log in!'))

// In this route you can see that if the user is logged in u can acess his info in: req.user
app.get('/success', isLoggedIn, (req, res) =>{
  res.render("home/index",{name:req.user.displayName,pic:req.user.photos[0].value,email:req.user.emails[0].value})
})


app.get('/video', isLoggedIn, (req,res)=>{
  res.render("video/index")
})
// app.get('/chat', isLoggedIn, (req,res)=>{
//   res.render("messenger-javascript-master/messenger")
// })
// Auth Routes
app.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/google/callback', passport.authenticate('google', { failureRedirect: '/failed' }),
function(req, res) {
  // Successful authentication, redirect home.
  res.redirect('/success');
}
);

app.get('/logout', (req, res) => {
  req.session = null;
  req.logout();
  res.redirect('/');
})
// Create http server and run it
const server = http.createServer(app);
const port = process.env.PORT || 5000;
server.listen(port, function() {
  console.log('Express server running on *:' + port);
});

module.exports = app;
