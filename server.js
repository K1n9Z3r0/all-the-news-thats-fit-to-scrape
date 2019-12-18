var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var mongoose = require('mongoose');
var path = require('path');
var request = require('request');
var cheerio = require('cheerio');
var db = require("./models");

mongoose.Promise = Promise;

var PORT = process.env.PORT || 3000;

var app = express();

app.use(logger("dev"));
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'));

var MONGODB_URI = process.env.MONGODB_URI || "mongodb://news:Pass9376@ds163745.mlab.com:63745/heroku_cb0dgjh0";

var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({defaultLayout: "main", partialsDir: path.join(__dirname, "/views/layouts/partials")}));
app.set('view engine', 'handlebars');

mongoose.connect(MONGODB_URI);
var conn = mongoose.connection;

conn.on('error', function(error) {
    console.log('Mongoose error: ', error);
});

conn.once('open', function() {
    console.log('Mongoose connection successful.');
});

app.get("/", function(req, res) {
    db.Article.find({saved: false}, function(error, data) {
        var hbsObject = {
            article: data
        };
        console.log(hbsObject);
        res.render("home", hbsObject);
    })
})

app.get("/saved", function(req, res) {
    db.Article.find({saved: true})
    .populate("notes")
    .exec(function(error, articles) {
        var hbsObject = {
            article: articles
        };
        res.render("saved", hbsObject);
    });
});

app.get('/scrape', function(req, res) {
    request('http://www.echojs.com', function(error, response, html) {
        var $ = cheerio.load(html);

        $('article h2').each(function(i, element) {
            let result = {};

            result.title = $(this).children('a').text();
            result.link = $(this).children('a').attr('href');

            db.Article.create(result)
                .then(function(dbArticle) {
                    console.log(dbArticle);
                })
                .catch(function(err) {
                    console.log(err);
                });
        });
        res.send("Scrape Complete");
    });
});

app.get("/articles", function(req, res) {
    db.Article.find({})
    .then(function(dbArticle) {
        res.json(dbArticle);
    })
    .catch(function(err) {
        res.json(err);
    });
});

app.get('/articles/:id', function(req, res) {
    db.Article.findOne({ _id: req.params.id })
    .populate('note')
    .then(function(dbArticle) {
        res.json(dbArticle);
    })
    .catch(function(err) {
        res.json(err);
    });
});

app.post('/articles/save/:id', function(req, res) {
    db.Article.findOneAndUpdate({ _id: req.params.id }, { saved: true})
    .then(function(dbArticle) {
        res.json(dbArticle);
    })
    .catch(function(err) {
        res.json(err);
    });
});

app.post('/articles/delete/:id', function(req, res) {
    db.Article.findOneAndUpdate({ _id: req.params.id }, { saved: false, notes: [] }, function(err) {
        if (err) {
            console.log(err);
            res.end(err);
        }    
        else {
            db.Note.deleteMany({ article: req.params.id })
            .exec(function(err) {
                if (err) {
                    console.log(err);
                    res.end(err);
                } else
                res.send("Article Deleted");
            });
        }        
    }); 
});

app.post("/notes/save/:id", function(req, res) {
    var newNote = new db.Note ({
        body: req.body.text,
        article: req.params.id
    });
    newNote.save(function(error, note) {
        return db.Article.findOneAndUpdate({ _id: req.params.id }, {$push: {notes: note}})
    .exec(function(err) {
        if (err) {
            console.log(err);
            res.send(err);
        } else {
            res.send(note);
        }
        });    
    });
});    

app.delete('/notes/delete/:note_id/:article_id', function(req, res) {
    db.Note.findOneAndRemove({ _id: req.params.note_id }, function(err) {
        if (err) {
            console.log(err);
            res.send(err);
        } else {
            db.Article.findOneAndUpdate({ _id: req.params.article_id }, {$pull: {notes: req.params.note_id}})
            .exec(function(err) {
                if (err) {
                    console.log(err);
                    res.send(err);
                } else {
                    res.end("Note Deleted");
                }
            });
        }
    });
});

app.listen(PORT, function() {
    console.log(`App running on port ${PORT}!`);
})