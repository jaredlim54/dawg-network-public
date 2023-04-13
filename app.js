import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import db from './db.js';

import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';
import apiRouter from './routes/api/api.js';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

import sessions from 'express-session';
import msIdExpress from 'microsoft-identity-express'

import { appCredentialsClientInfo, clientSecretKey, cookieTime } from './privateConstants.js';

const appSettings = {
    appCredentials:
        appCredentialsClientInfo,
    authRoutes: {
        redirect: "http://localhost:3000/redirect",
        error: "/error", // the wrapper will redirect to this route in case of any error.
        unauthorized: "/unauthorized" // the wrapper will redirect to this route in case of unauthorized access attempt.
    }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());


app.use(sessions({
    secret: clientSecretKey,
    saveUninitialized: true,
    cookie: cookieTime,
    resave: false
}))

const msid = new msIdExpress.WebAppAuthClientBuilder(appSettings).build();
app.use(msid.initialize());

app.use(express.static(path.join(__dirname, 'public')));
app.use( function (req, res, next) {
    req.db = db;
    next();
})

// eventually will redirect to the modular chat page thing once it's built
app.get('/signin',
    msid.signIn({postLoginRedirect: '/home'})
)

app.get('/signout',
    msid.signOut({postLogoutRedirect: '/'})
)

app.get('/error', (req, res) => res.status(500).send('Server Error'))

app.get('/unauthorized', (req, res) => res.status(401).send('Permission Denied'))

// auto-redirect to login page if user is not logged in (Only pages non-logged in user can access are homepage and login page)
// also works backwards, if user is already logged in they cannot access login page
app.use(async function(req, res, next) {
    if (req.session.isAuthenticated) {
        // essentially creating user in db upon log in
        let userInfo = await req.db.User.find({ username: req.session.account.username})
        let userInfoObj = userInfo[0]
        if (!userInfoObj) {
            const newUser = new req.db.User({
                username: req.session.account.username,
                full_name: req.session.account.name,
                major: "N/A",
                profession: "N/A",
                interest: "N/A",
                likes: [req.session.account.username]
            })
            await newUser.save()
        }
        if(req.url === "/users/login" || req.url === "/users/login/") {
            res.redirect("/home");
        } else {
            next();
        }
    } else {
        if(req.url === "/users/login" || req.url === "/users/login/") {
            next();
        } else {
            res.redirect('/users/login');    
        }
    }
});

// "/" route can be something similiar to an about page
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api', apiRouter)


export default app;
