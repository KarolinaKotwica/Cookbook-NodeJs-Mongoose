//jshint esversion:6
require('dotenv').config()
const express = require("express");
const ejs = require("ejs");
var _ = require('lodash');
const app = express();
const mongoose = require('mongoose');
const multer  = require('multer');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
var S3 = require('aws-sdk/clients/s3');
const AWS = require('aws-sdk');
const fs = require('fs');
const models = require("./models");
const { User, Recipe, List } = models;
const MemoryStore = require('memorystore')(session);
const expressSitemapXml = require('express-sitemap-xml');
const path = require("path");
const mailchimp = require("@mailchimp/mailchimp_marketing");
var md5 = require('md5');
var xml = require('xml');
require('aws-sdk/lib/maintenance_mode_message').suppress = true;

const {verify} = require('hcaptcha');
const secret = process.env.HCAPTCHA_SECRET;
const token = 'token from widget';

verify(secret, token)
  .then((data) => {
    if (data.success === true) {
      console.log('success!', data);
    } else {
      console.log('verification failed');
    }
  })
  .catch(console.error);

//mailchimp
mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API,
    server: "US21",
});

mongoose.set('strictQuery', false);

// pdf
const dirPath = path.join(__dirname, "public/pdfs");

const files = fs.readdirSync(dirPath).map(name => {
    return {
      name: path.basename(name, ".pdf"),
      url: `/pdfs/${name}`
    };
});
//


app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: false}));
app.use(express.json());
app.use(express.static("public"));

// app.use(expressFileUpload());

app.set('trust proxy', 1);


// use the session package and set it up with some initial configuration
app.use(session({
    secret: 'keyboard cat',
    resave: true,
    saveUninitialized: true
}))


/// s3 /////
const accessKey = process.env.S3_BUCKET_ACCESS_KEY;
const secretKey = process.env.S3_SECRET_ACCESS_KEY;
const region = process.env.S3_BUCKET_LOCATION;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

AWS.config.update({
    region: region,
    accessKeyId: accessKey,
    secretAccessKey: secretKey
});

const s3 = new S3({
    region,
    secretKey,
    accessKey
})

//upload to s3

function uploadFile(file) {
    const fileStream = fs.createReadStream(file.path)
  
    const uploadParams = {
      Bucket: S3_BUCKET_NAME,
      Body: fileStream,
      Key: file.filename
    }
  
    return s3.upload(uploadParams).promise()
}

//download from s3
function getFileStream(fileKey) {
    const downloadParams = {
      Key: file.filename,
      Bucket: S3_BUCKET_NAME
    }
  
    return s3.getObject(downloadParams).createReadStream()
  }

//////// end s3 //


app.use(cookieParser('secret'));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
app.use(function (req, res, next) {
    res.locals.session = req.session;
    next();
});

/////////////connect and create DB ///////////////
mongoose.connect(process.env.DB_MONGOOSE);


//Configuration for Multer //
const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "public/imgs");
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: multerStorage
});



/////////////////// Routes ///////////////////////////////////


app.get('/', async (req,res) => {
    Recipe.find({},async (err, foundRecipe) => {
        let count = await Recipe.find().countDocuments();
        let random = Math.floor(Math.random()*count);
        let randomRecipe = await Recipe.findOne().skip(random);
        res.render('index', {
            recipes: foundRecipe,random: randomRecipe, files: files });
    }).sort({_id: -1}).limit(20);
})


app.get('/sitemap', function(req, res) {
    res.set('Content-Type', 'text/xml');
    res.send(xml('./public/sitemap.xml'));
});

// app.get('/auth/google',
//   passport.authenticate('google', { scope: ["profile"] }));

//   app.get('/auth/google/callback',
//   passport.authenticate('google', { failureRedirect: '/login' }),
//   function(req, res) {
//     res.redirect('/user');
// });

app.get('/wszystkie-przepisy/:page', async (req,res) => {
    var perPage = 20;
    const page = req.params.page;

    await Recipe.find({})
        .skip((perPage * page) - perPage)
        .limit(perPage)
        .sort({_id: -1})
        .exec(function(err, foundRecipe) {
        Recipe.count().exec(function(err, count) {
                if (err) return next(err)
        res.render('wszystkie-przepisy', {
            recipes: foundRecipe,
            current: page,
            files: files,
            pages: Math.ceil(count / perPage)});
    });
})
})

app.get('/users-recipe/:id', (req,res)=> {
    const idUser = req.params.id;

    User.findById(idUser, (err, user)=> {
        if (user) {
            res.render('users-recipe', {
                recipes: user.recipes,
                files: files
            })
        }
    })
})

app.get('/shopList', (req,res)=> {
    if(req.isAuthenticated()) {
        User.findById(req.user.id, (err, found)=> {
            res.render('shopList', {newListItems: found.list, files: files});
        })

    } else {
        res.redirect('/login');
    }
})

app.post('/shopList', (req,res)=> {

    User.findById(req.user.id, (err, foundUser) => {
        if(err) {console.log(err);}
        else {

            let list = new List({
                item: req.body.newItem
            })

            foundUser.list.push(list);

            foundUser.save();
            res.redirect("/shopList");
        }
    })
})



app.get('/user', (req,res) => {
    if(req.isAuthenticated()) {
        req.session.loggedin = true;
        User.findById(req.user.id, (err, foundUsers) => {
            if(err) {console.log(err);}
            else {
                if(foundUsers) {
                    res.render('user', {userRecipe: foundUsers.recipes, user: foundUsers, favorite: foundUsers.favorite});
                }
            }
        })
    } else {
        req.session.loggedin = false;
        res.redirect('/login');
    }
})


app.get('/favoriteUser', (req,res) => {
    if(req.isAuthenticated()) {
        req.session.loggedin = true;
        User.findById(req.user.id, (err, foundUsers) => {
            if(err) {console.log(err);}
            else {
                if(foundUsers) {
                    res.render('favoriteUser', {user: foundUsers, favorite: foundUsers.favorite});
                }
            }
        })
    } else {
        req.session.loggedin = false;
        res.redirect('/login');
    }
})

app.get('/planer', (req,res) => {
    if(req.isAuthenticated()) {
        req.session.loggedin = true;
        User.findById(req.user.id, (err, foundUsers) => {
            if(err) {console.log(err);}
            else {
                if(foundUsers) {
                    res.render('planer', {user: foundUsers, planer: foundUsers.planer});
                }
            }
        })
    } else {
        req.session.loggedin = false;
        res.redirect('/login');
    }
})

// app.get('/logout', (req, res) => {
//     req.logout();
//     req.session.loggedin = false;
//     res.redirect('/');
// });
app.get("/logout", (req, res) => {
    req.logout(req.user, err => {
      if(err) return next(err);
      res.redirect("/");
    });
  });


app.get('/images/:key', (req, res) => {
    // console.log(req.params)
    const key = req.params.key
    const readStream = getFileStream(key)
  
    readStream.pipe(res)
})

app.get('/przepisy/:postId', async (req, res) => {

    const paramId = (req.params.postId);

    const favoriteFlash = req.flash('favorite');
    const favoriteFlashError = req.flash('favorite-error');
    const planerFlash = req.flash('planer');
    const planerFlashError = req.flash('planer-error');

    Recipe.findOne({_id: paramId}, (err, found) => {

        Recipe.findRandom({category: found.category}, {}, {limit: 4}, function(err, results) {
        if (!err) {
            // console.log(results); ??
        }
            
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
        favoriteFlash,
        favoriteFlashError,
        planerFlash,
        planerFlashError,
        idUser: found.idUser,
        recipes: results,
        files: files
      });
    })
});
})

app.post('/favorite/:id', (req,res)=> {
   Recipe.findById(req.params.id, (err, found) => {
        if(err) {console.log(err);}
        else {
            User.findById(req.user.id, (err, foundUser) => {
                if(err) {console.log(err);}
                else {
                    User.countDocuments({_id: req.user.id,'favorite._id':req.params.id}, function (err, count){
                        console.log(count); 
                        if(count===0){
                            //document  ! exists
                            foundUser.favorite.push(found);
                            foundUser.save();
                            req.flash('favorite', "Dodano do ulubionych!");
                            res.redirect("/przepisy/"+req.params.id);
                        }
                        else {
                            req.flash('favorite-error', "Masz już dodany ten przepis :)");
                            res.redirect("/przepisy/"+req.params.id);
                        }
                    });
                    
                    
                }
            })
        }
    })
})

app.post('/planer/:id', (req,res)=> {
    Recipe.findById(req.params.id, (err, found) => {
         if(err) {console.log(err);}
         else {
             User.findById(req.user.id, (err, foundUser) => {
                 if(err) {console.log(err);}
                 else {
                     User.countDocuments({_id: req.user.id,'planer._id':req.params.id}, function (err, count){
                         console.log(count); 
                         if(count===0){
                             //document  ! exists
                             foundUser.planer.push(found);
                             foundUser.save();
                             req.flash('planer', "Dodano do planera!");
                             res.redirect("/przepisy/"+req.params.id);
                         }
                         else {
                             req.flash('planer-error', "Masz już dodany ten przepis :)");
                             res.redirect("/przepisy/"+req.params.id);
                         }
                     });
                     
                     
                 }
             })
         }
     })
 })

app.get('/add', (req,res) => {
    const add = req.flash('newRecipe');
    if(req.isAuthenticated()) {
        res.render('add', {add});
    } else {
        res.redirect('/login');
    }
})


app.post('/', upload.single('image'), (req,res) => {

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

        const img = req.file;

        const result = uploadFile(img);
        console.log(result);

        recipe.save((err) => {
            if (err) {
                req.flash('newRecipe', 'Sprawdź czy dobrze wypełniłeś/aś pola oraz nie zapomnij dodać obrazka.');
                res.redirect("/add");
            }
            else {
                User.findById(req.user.id, (err, foundUser) => {
                    if(err) {console.log(err);}
                    else {
                        foundUser.recipes.push(recipe);
        
                        foundUser.save();
                        res.redirect("/user");
                    }
                })
            }
        });

    } catch(err) {
        console.log(err);
        req.flash('newRecipe', 'Sprawdź czy dobrze wypełniłeś/aś pola oraz nie zapomnij dodać obrazka.');
        res.redirect("/add");
    }
})

app.post('/register', (req,res) => {
    req.flash('registrations_error_username', "Istnieje już taka nazwa użytkownika w bazie!");

    const newUser = new User({
        username: _.trim(req.body.username),
        email: _.trim(req.body.email),
        recipes: [],
        favorite: [],
        planer: []
    })

    User.find({}, (err)=> {
        if(err) {
            req.flash('registrations', "Wystąpił błąd.");
            res.redirect('/login');
        } else {
            User.find({username: req.body.username}, (err, foundUser) => {
                if(foundUser.username === req.body.username) {
                    
                    res.redirect('/login');
                } else {
                    User.register(newUser, req.body.password, (err, user) => {

                        passport.authenticate("local", { failureRedirect: '/login' })(req,res,function(){
                            res.redirect("/user");
                        })
                    })
                }
            })
            
        }
    })

    
})

app.get('/login', (req,res) => {
    const userName = req.flash('user');
    const registrations = req.flash('registrations');
    const registrations_error_username = req.flash('registrations_error_username');
    res.render('login', {userName, registrations, registrations_error_username});
})

app.post('/login', (req,res) => {

    req.flash('user', "Niepoprawny login lub hasło");

    const user = new User({
        username: (req.body.username).trim(),
        password: (req.body.password).trim()
    })

    req.login(user, (err) => {
        if (err) {
            res.redirect('/login');
        }
        else {
            passport.authenticate("local", { failureRedirect: '/login' })(req,res,function(){
            res.redirect("/user");
            })
        }
    });

})

app.post('/search', async (req, res) => {

    const allRecipes = Recipe.find({}, "title describe", (err, docs) => {
        if (err) console.log(err);
        console.log(docs);
    });
    Recipe.find({ title: { $regex: req.body.search, $options: "i" } }, (err, docs) => {
        if (!err) {
            res.render('search', { found: docs, files: files } );
        } else {
            console.log(err)
        }
        });
})



app.get("/obiad", (req,res) => {

    Recipe.find({category: "Obiad"}, (err, foundRecipe) => {
        res.render('obiad', {
            recipes: foundRecipe, files: files});
    }).sort({_id: -1});
})

app.get("/desery", (req,res) => {
    Recipe.find({category: "Desery"}, (err, foundRecipe) => {
        res.render('desery', {
            recipes: foundRecipe, files: files});
    }).sort({_id: -1});
})

app.get("/dodatki", (req,res) => {
    Recipe.find({category: "Dodatki"}, (err, foundRecipe) => {
        res.render('dodatki', {
            recipes: foundRecipe, files: files});
    }).sort({_id: -1});
})

app.get("/salatki", (req,res) => {
    Recipe.find({category: "Sałatki"}, (err, foundRecipe) => {
        res.render('salatki', {
            recipes: foundRecipe, files: files});
    }).sort({_id: -1});
})

app.get("/zupy", (req,res) => {
    Recipe.find({category: "Zupy"}, (err, foundRecipe) => {
        res.render('zupy', {
            recipes: foundRecipe, files: files});
    }).sort({_id: -1});
})

app.get("/sniadanie", (req,res) => {
    Recipe.find({category: "Śniadanie"}, (err, foundRecipe) => {
        res.render('sniadanie', {
            recipes: foundRecipe, files: files});
    }).sort({_id: -1});
})

app.get("/przekaski", (req,res) => {
    Recipe.find({category: "Przekąski"}, (err, foundRecipe) => {
        res.render('przekaski', {
            recipes: foundRecipe, files: files});
    }).sort({_id: -1});
})

app.get("/dla-dzieci", (req,res) => {
    Recipe.find({category: "Dla dzieci"}, (err, foundRecipe) => {
        res.render('dla-dzieci', {
            recipes: foundRecipe, files: files});
    }).sort({_id: -1});
})

app.get("/torty", (req,res) => {
    Recipe.find({category: "Torty"}, (err, foundRecipe) => {
        res.render('torty', {
            recipes: foundRecipe, files: files});
    }).sort({_id: -1});
})

// app.post("/delete", (req,res) => {
//     const checkItemId = req.body.checkbox;

//     Recipe.findByIdAndDelete(checkItemId, (err) => {
//         if (err) {console.log(err);}
//         else {
//             console.log("Successfully removed");
//             res.redirect("/user");
//         }
//     })

//     User.findOneAndUpdate({_id: req.user.id}, { "$pull": { "recipes": { "_id": checkItemId } }}, { safe: true, multi:true }, function(err, obj) {
//         if(!err) {console.log("Successfully removed");}
//     })
// })

app.post('/delete_item_list', (req,res)=> {
    const checkbox = req.body.checkbox;

    User.findOneAndUpdate({_id: req.user.id}, { "$pull": { "list": { "_id": checkbox } }}, { safe: true, multi:true }, function(err, obj) {
        if(!err) {
            console.log("Successfully removed");
            res.redirect("/shopList");
        }
    })

})

app.post('/delete_favorite', (req,res)=> {
    const checkItemId = req.body.checkbox;

    User.findOneAndUpdate({_id: req.user.id}, { "$pull": { "favorite": { "_id": checkItemId } }}, { safe: true, multi:true }, function(err, obj) {
        if(!err) {
            console.log("Successfully removed");
            res.redirect("/favoriteUser");
        }
    })
})

app.post('/delete_planer', (req,res)=> {
    const checkItemId = req.body.checkbox;

    User.findOneAndUpdate({_id: req.user.id}, { "$pull": { "planer": { "_id": checkItemId } }}, { safe: true, multi:true }, function(err, obj) {
        if(!err) {
            console.log("Successfully removed");
            res.redirect("/planer");
        }
    })
})


// post edit
app.post("/edit/:id", upload.single('image'), (req, res) => {
    User.findOneAndUpdate({_id: req.user.id, 'recipes._id': req.params.id}, 
        {"$set" : {
        'recipes.$.publisher': req.body.publisher,
        'recipes.$.title': req.body.title,
        'recipes.$.time': req.body.time,
        'recipes.$.ingredients': req.body.ingredients,
        'recipes.$.describe': req.body.describe,
        'recipes.$.preparation': req.body.preparation }},
        {new: true},
        function(err, obj) {
        if(!err) {console.log("Successfully updated");}
    });
    User.updateMany({'favorite._id': req.params.id}, 
    {"$set" : {
    'favorite.$.publisher': req.body.publisher,
    'favorite.$.title': req.body.title,
    'favorite.$.time': req.body.time,
    'favorite.$.ingredients': req.body.ingredients,
    'favorite.$.describe': req.body.describe,
    'favorite.$.preparation': req.body.preparation }},
    {new: true},
    function(err, obj) {
    if(!err) {console.log("Successfully updated");}
});
    Recipe.findByIdAndUpdate(req.params.id, {
        publisher: req.body.publisher,
        title: req.body.title,
        time: req.body.time,
        ingredients: req.body.ingredients,
        describe: req.body.describe,
        preparation: req.body.preparation,
        idUser: req.user.id
    },
    {new: true},
    (err, update) => {
        if(err) {console.log(err);}
        else {
            res.redirect('/user' )
        }
    })
});

// Rabaty
app.get('/rabaty', (req,res) => {
    res.render('rabaty', {files: files});
})


// NEWSLETTER
app.get('/signup', (req,res)=> {
    res.render('newsletter/signup')
})

app.post('/signup', (req,res) => {
    const listId = "ba57f81267";
    const subscribingUser = {
        firstName: req.body.firstname,
        email: req.body.email
    };

    async function run() {
        const response = await mailchimp.lists.addListMember(listId, {
          email_address: subscribingUser.email,
          status: "subscribed",
          merge_fields: {
            FNAME: subscribingUser.firstName
          }
        })
        .catch(err => console.error(err))

        console.log(
        `Successfully added contact as an audience member. The contact's id is ${response.id}.`
        );
      }

    
      
    run();
    res.render('newsletter/message');

})

app.get('/unsubscribe', (req,res) => {
    res.render('newsletter/unsubscribe')
})

app.post('/unsub', (req,res) => {
    const listId = process.env.LIST_ID;
    const email = req.body.unsub;
    const subscriberHash = md5(_.toLower(email));

    async function run() {
    const response = await mailchimp.lists.updateListMember(
            listId,
            subscriberHash,
            {
            status: "unsubscribed"
            }
        );

        console.log(`This user is now ${response.status}.`);
    }

    run();
    res.redirect('/')
})

// edit form
app.get("/edit/:id", (req, res) => {
    Recipe.findById(req.params.id, (err, found) => {
        if(err) {console.log(err);}
        else {
            res.render('edit', {edit: found})
        }
    })
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port);