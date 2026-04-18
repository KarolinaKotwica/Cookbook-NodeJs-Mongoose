require('dotenv').config();
const express = require('express');
const _ = require('lodash');
const app = express();
const mongoose = require('mongoose');
const multer = require('multer');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const AWS = require('aws-sdk');
const fs = require('fs');
const models = require('./models');
const { User, Recipe, List } = models;
const MemoryStore = require('memorystore')(session);
const path = require('path');
const mailchimp = require('@mailchimp/mailchimp_marketing');
const md5 = require('md5');

// Mailchimp
mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API,
    server: 'US21',
});

mongoose.set('strictQuery', false);

// PDF files list — bezpieczny odczyt katalogu
const dirPath = path.join(__dirname, 'public/pdfs');
let files = [];
try {
    files = fs.readdirSync(dirPath).map(name => ({
        name: path.basename(name, '.pdf'),
        url: `/pdfs/${name}`
    }));
} catch (err) {
    console.error('Nie można odczytać katalogu pdfs:', err.message);
}

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static('public'));
app.set('trust proxy', 1);

// Sesja z MemoryStore i sekretem z .env
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-zmien-w-env',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
        checkPeriod: 86400000 // czyszczenie co 24h
    })
}));

// AWS S3
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

AWS.config.update({
    region: process.env.S3_BUCKET_LOCATION,
    accessKeyId: process.env.S3_BUCKET_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();

function uploadFile(file) {
    const fileStream = fs.createReadStream(file.path);
    return s3.upload({
        Bucket: S3_BUCKET_NAME,
        Body: fileStream,
        Key: file.filename
    }).promise();
}

// BUGFIX: było `file.filename` zamiast `fileKey`
function getFileStream(fileKey) {
    return s3.getObject({
        Key: fileKey,
        Bucket: S3_BUCKET_NAME
    }).createReadStream();
}

app.use(cookieParser('secret'));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

mongoose.connect(process.env.DB_MONGOOSE);

// Multer — sanityzacja nazwy pliku (ochrona przed path traversal)
const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/imgs');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '');
        const safeName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
        cb(null, safeName);
    }
});

const upload = multer({ storage: multerStorage });

// Middleware autoryzacji — używany na chronionych trasach
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

/////////////////// Routes ///////////////////////////////////

app.get('/', async (req, res) => {
    try {
        const recipes = await Recipe.find({}).sort({ _id: -1 }).limit(20);
        const count = await Recipe.countDocuments();
        const randomRecipe = await Recipe.findOne().skip(Math.floor(Math.random() * count));
        res.render('index', { recipes, random: randomRecipe, files });
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/sitemap', (req, res) => {
    res.set('Content-Type', 'text/xml');
    res.sendFile(path.join(__dirname, 'public/sitemap.xml'));
});

app.get('/wszystkie-przepisy/:page', async (req, res) => {
    const perPage = 20;
    const page = parseInt(req.params.page) || 1;
    try {
        const [recipes, count] = await Promise.all([
            Recipe.find({}).skip((perPage * page) - perPage).limit(perPage).sort({ _id: -1 }),
            Recipe.countDocuments()
        ]);
        res.render('wszystkie-przepisy', {
            recipes,
            current: page,
            files,
            pages: Math.ceil(count / perPage)
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/users-recipe/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            res.render('users-recipe', { recipes: user.recipes, files });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/shopList', isAuthenticated, async (req, res) => {
    try {
        const found = await User.findById(req.user.id);
        res.render('shopList', { newListItems: found.list, files });
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.post('/shopList', isAuthenticated, async (req, res) => {
    try {
        const foundUser = await User.findById(req.user.id);
        foundUser.list.push(new List({ item: req.body.newItem }));
        await foundUser.save();
        res.redirect('/shopList');
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/user', isAuthenticated, async (req, res) => {
    try {
        req.session.loggedin = true;
        const foundUser = await User.findById(req.user.id);
        if (foundUser) {
            res.render('user', { userRecipe: foundUser.recipes, user: foundUser, favorite: foundUser.favorite });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/favoriteUser', isAuthenticated, async (req, res) => {
    try {
        req.session.loggedin = true;
        const foundUser = await User.findById(req.user.id);
        if (foundUser) {
            res.render('favoriteUser', { user: foundUser, favorite: foundUser.favorite });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/planer', isAuthenticated, async (req, res) => {
    try {
        req.session.loggedin = true;
        const foundUser = await User.findById(req.user.id);
        if (foundUser) {
            res.render('planer', { user: foundUser, planer: foundUser.planer });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/logout', (req, res, next) => {
    req.logout(req.user, err => {
        if (err) return next(err);
        res.redirect('/');
    });
});

app.get('/images/:key', (req, res) => {
    const readStream = getFileStream(req.params.key);
    readStream.pipe(res);
});

app.get('/przepisy/:postId', async (req, res) => {
    try {
        const found = await Recipe.findById(req.params.postId);
        if (!found) return res.status(404).send('Nie znaleziono przepisu');

        const results = await new Promise((resolve, reject) => {
            Recipe.findRandom({ category: found.category }, {}, { limit: 4 }, (err, r) => {
                if (err) reject(err);
                else resolve(r);
            });
        });

        res.render('przepisy', {
            id: found._id,
            publisher: found.publisher,
            title: found.title,
            time: found.time,
            category: found.category,
            image: found.image,
            ingredients: found.ingredients,
            describe: found.describe,
            preparation: found.preparation,
            created: found.created,
            favoriteFlash: req.flash('favorite'),
            favoriteFlashError: req.flash('favorite-error'),
            planerFlash: req.flash('planer'),
            planerFlashError: req.flash('planer-error'),
            idUser: found.idUser,
            recipes: results,
            files
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.post('/favorite/:id', isAuthenticated, async (req, res) => {
    try {
        const count = await User.countDocuments({ _id: req.user.id, 'favorite._id': req.params.id });
        if (count === 0) {
            const [found, foundUser] = await Promise.all([
                Recipe.findById(req.params.id),
                User.findById(req.user.id)
            ]);
            foundUser.favorite.push(found);
            await foundUser.save();
            req.flash('favorite', 'Dodano do ulubionych!');
        } else {
            req.flash('favorite-error', 'Masz już dodany ten przepis :)');
        }
        res.redirect('/przepisy/' + req.params.id);
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.post('/planer/:id', isAuthenticated, async (req, res) => {
    try {
        const count = await User.countDocuments({ _id: req.user.id, 'planer._id': req.params.id });
        if (count === 0) {
            const [found, foundUser] = await Promise.all([
                Recipe.findById(req.params.id),
                User.findById(req.user.id)
            ]);
            foundUser.planer.push(found);
            await foundUser.save();
            req.flash('planer', 'Dodano do planera!');
        } else {
            req.flash('planer-error', 'Masz już dodany ten przepis :)');
        }
        res.redirect('/przepisy/' + req.params.id);
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/add', isAuthenticated, (req, res) => {
    res.render('add', { add: req.flash('newRecipe') });
});

app.post('/', isAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const recipe = new Recipe({
            publisher: req.body.publisher,
            title: req.body.title,
            time: req.body.time,
            image: req.file.filename,
            category: req.body.category,
            ingredients: req.body.ingredients,
            describe: req.body.describe,
            preparation: req.body.preparation,
            idUser: req.user.id
        });

        await uploadFile(req.file);
        await recipe.save();

        const foundUser = await User.findById(req.user.id);
        foundUser.recipes.push(recipe);
        await foundUser.save();
        res.redirect('/user');
    } catch (err) {
        console.error(err);
        req.flash('newRecipe', 'Sprawdź czy dobrze wypełniłeś/aś pola oraz nie zapomnij dodać obrazka.');
        res.redirect('/add');
    }
});

// BUGFIX: findOne zamiast find, poprawne sprawdzenie duplikatu
app.post('/register', async (req, res) => {
    try {
        const existingUser = await User.findOne({ username: req.body.username });
        if (existingUser) {
            req.flash('registrations_error_username', 'Istnieje już taka nazwa użytkownika w bazie!');
            return res.redirect('/login');
        }

        const newUser = new User({
            username: _.trim(req.body.username),
            email: _.trim(req.body.email),
            recipes: [],
            favorite: [],
            planer: []
        });

        await User.register(newUser, req.body.password);
        passport.authenticate('local', { failureRedirect: '/login' })(req, res, () => {
            res.redirect('/user');
        });
    } catch (err) {
        console.error(err);
        req.flash('registrations', 'Wystąpił błąd.');
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    res.render('login', {
        userName: req.flash('user'),
        registrations: req.flash('registrations'),
        registrations_error_username: req.flash('registrations_error_username')
    });
});

app.post('/login', (req, res) => {
    req.flash('user', 'Niepoprawny login lub hasło');

    const user = new User({
        username: req.body.username.trim(),
        password: req.body.password.trim()
    });

    req.login(user, err => {
        if (err) return res.redirect('/login');
        passport.authenticate('local', { failureRedirect: '/login' })(req, res, () => {
            res.redirect('/user');
        });
    });
});

// BUGFIX: escapowanie inputu użytkownika przed użyciem w regex (ochrona przed ReDoS)
app.post('/search', async (req, res) => {
    try {
        const escaped = req.body.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const docs = await Recipe.find({ title: { $regex: escaped, $options: 'i' } });
        res.render('search', { found: docs, files });
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

// Trasy kategorii — skondensowane z 9 identycznych tras do jednej pętli
const categoryMap = {
    'obiad': 'Obiad',
    'desery': 'Desery',
    'dodatki': 'Dodatki',
    'salatki': 'Sałatki',
    'zupy': 'Zupy',
    'sniadanie': 'Śniadanie',
    'przekaski': 'Przekąski',
    'dla-dzieci': 'Dla dzieci',
    'torty': 'Torty'
};

Object.entries(categoryMap).forEach(([route, category]) => {
    app.get(`/${route}`, async (req, res) => {
        try {
            const recipes = await Recipe.find({ category }).sort({ _id: -1 });
            res.render(route, { recipes, files });
        } catch (err) {
            console.error(err);
            res.status(500).send('Błąd serwera');
        }
    });
});

// DELETE — dodano isAuthenticated
app.post('/delete_item_list', isAuthenticated, async (req, res) => {
    try {
        await User.findOneAndUpdate(
            { _id: req.user.id },
            { $pull: { list: { _id: req.body.checkbox } } }
        );
        res.redirect('/shopList');
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.post('/delete_favorite', isAuthenticated, async (req, res) => {
    try {
        await User.findOneAndUpdate(
            { _id: req.user.id },
            { $pull: { favorite: { _id: req.body.checkbox } } }
        );
        res.redirect('/favoriteUser');
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.post('/delete_planer', isAuthenticated, async (req, res) => {
    try {
        await User.findOneAndUpdate(
            { _id: req.user.id },
            { $pull: { planer: { _id: req.body.checkbox } } }
        );
        res.redirect('/planer');
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

// EDIT — dodano isAuthenticated + sprawdzenie właściciela przepisu
app.get('/edit/:id', isAuthenticated, async (req, res) => {
    try {
        const found = await Recipe.findById(req.params.id);
        if (!found || found.idUser.toString() !== req.user.id) {
            return res.redirect('/user');
        }
        res.render('edit', { edit: found });
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.post('/edit/:id', isAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe || recipe.idUser.toString() !== req.user.id) {
            return res.redirect('/user');
        }

        const update = {
            publisher: req.body.publisher,
            title: req.body.title,
            time: req.body.time,
            ingredients: req.body.ingredients,
            describe: req.body.describe,
            preparation: req.body.preparation
        };

        const embeddedSet = (prefix) => ({
            $set: {
                [`${prefix}.$.publisher`]: update.publisher,
                [`${prefix}.$.title`]: update.title,
                [`${prefix}.$.time`]: update.time,
                [`${prefix}.$.ingredients`]: update.ingredients,
                [`${prefix}.$.describe`]: update.describe,
                [`${prefix}.$.preparation`]: update.preparation
            }
        });

        await Promise.all([
            Recipe.findByIdAndUpdate(req.params.id, update),
            User.findOneAndUpdate({ _id: req.user.id, 'recipes._id': req.params.id }, embeddedSet('recipes')),
            User.updateMany({ 'favorite._id': req.params.id }, embeddedSet('favorite')),
            User.updateMany({ 'planer._id': req.params.id }, embeddedSet('planer'))
        ]);

        res.redirect('/user');
    } catch (err) {
        console.error(err);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/rabaty', (req, res) => {
    res.render('rabaty', { files });
});

// Newsletter — BUGFIX: await na mailchimp, listId z .env
app.get('/signup', (req, res) => {
    res.render('newsletter/signup');
});

app.post('/signup', async (req, res) => {
    try {
        await mailchimp.lists.addListMember(process.env.LIST_ID, {
            email_address: req.body.email,
            status: 'subscribed',
            merge_fields: { FNAME: req.body.firstname }
        });
        res.render('newsletter/message');
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

app.get('/unsubscribe', (req, res) => {
    res.render('newsletter/unsubscribe');
});

app.post('/unsub', async (req, res) => {
    const subscriberHash = md5(_.toLower(req.body.unsub));
    try {
        await mailchimp.lists.updateListMember(process.env.LIST_ID, subscriberHash, { status: 'unsubscribed' });
    } catch (err) {
        console.error(err);
    }
    res.redirect('/');
});

const port = process.env.PORT || 3000;
app.listen(port);
