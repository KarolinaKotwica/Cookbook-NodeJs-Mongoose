const mongoose = require('mongoose');
const random = require('mongoose-simple-random');
const passportLocalMongoose = require('passport-local-mongoose');
const findOrCreate = require('mongoose-find-or-create');
const passport = require('passport');

//////////////////////////////////////////////////////////
/////////////////// Schema for recipe ////////////////////
//////////////////////////////////////////////////////////

const recipeSchema = new mongoose.Schema({
    publisher: {
        type: String,
        minLength: 1,
        maxLength: 50,
        trim: true,
        required: true
    },
    title: {
        type: String,
        minLength: 1,
        maxLength: 60,
        trim: true,
        required: true
    },
    time: {
        type: String,
        min: 1,
        max: 4320,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    ingredients: {
        type: Array,
        required: true
    },
    describe: {
        type: String,
        minLength: 1,
        maxLength: 1000,
        trim: true,
        required: true
    },
    preparation: {
        type: String,
        minLength: 1,
        maxLength: 2000,
        trim: true,
        required: true
    },
    created: {
        type: Date,
        default: Date.now
    },
    idUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

recipeSchema.plugin(random);
recipeSchema.index({ "$**": "text" });



// model recipe //
const Recipe = mongoose.model("Recipe", recipeSchema);




//////////////////////////////////////////////////////////
/////////////////// Schema for List //////////////////////
//////////////////////////////////////////////////////////
const listSchema = new mongoose.Schema({
    item: String
})
//model list //
const List = mongoose.model("List", listSchema);


//////////////////////////////////////////////////////////
/////////////////// Schema for users //////////////////////
//////////////////////////////////////////////////////////
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    created: {
        type: Date,
        default: Date.now
    },
    recipes: [recipeSchema],
    favorite: [recipeSchema],
    planer: [recipeSchema],
    list: [listSchema]
})

// hash, salt and add user to db
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// model user //
const User = mongoose.model("User", userSchema);




passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });

module.exports = { User, Recipe, List };