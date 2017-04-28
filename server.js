"use strict";
let express = require('express');
let mongo = require('mongodb');
const urlLocal = 'mongodb://localhost:27017/mongo';
const urlRemote = 'mongodb://milesxu:b!m4C0*b3jNF@ds062339.mlab.com:62339/mongo';
const localhost = 'http://localhost:8080/';
let app = express();

async function getShortUrl(params) {
    let conn = await mongo.MongoClient.connect(urlRemote)
        .catch(e => e);
    if (conn instanceof mongo.MongoError)
        return conn;
    let shortUrl = conn.collection('shorturl');
    let result = await shortUrl
        .findOne({
            url: params
        }, {
            short: 1,
            _id: 0
        })
        .catch(e => e);
    if (result) {
        conn.close();
        return result;
    }
    let existing = await shortUrl
        .aggregate([{
            $project: {
                short: 1
            }
        }])
        .toArray()
        .catch(e => e);
    if (existing instanceof mongo.MongoError) {
        conn.close();
        return existing;
    }
    const [low, high] = [1000, 9999];
    let conflict, short;
    do {
        conflict = false;
        short = Math.floor(Math.random() * (high - low + 1)) + low;
        let id = existing.findIndex(i => i.short === short);
        if (~id)
            conflict = true;
    } while (conflict);
    result = await shortUrl
        .insertOne({
            url: params,
            short: short
        })
        .catch(e => e);
    if (result instanceof mongo.MongoError) {
        conn.close();
        return result;
    }
    return {
        short: short
    };
}

async function getOriginUrl(i) {
    let conn = await mongo.MongoClient.connect(urlRemote)
        .catch(e => e);
    if (conn instanceof mongo.MongoError)
        return conn;
    let shortUrl = conn.collection('shorturl');
    let result = await shortUrl.findOne({
        short: i
    }, {
        url: 1,
        _id: 0
    });
    conn.close();
    return result;
}

app.use((req, res, next) => {
    if (req.method === 'GET') {
        const longUrl = /http(s)?:\/\/[^ "]+$/;
        const shortUrl = /[0-9]+$/;
        if (req.originalUrl.match(longUrl)) {
            let url = longUrl.exec(req.originalUrl)[0];
            getShortUrl(url).then(result => {
                if (!(result instanceof mongo.MongoError)) {
                    res.json({
                        original_url: url,
                        short_url: localhost + result.short
                    });
                } else
                    res.json({
                        Error: 'Database operation failed.'
                    });
            });
        } else if (req.originalUrl.match(shortUrl)) {
            let short = shortUrl.exec(req.originalUrl)[0];
            getOriginUrl(Number(short)).then(result => {
                if (result) {
                    if (result instanceof mongo.MongoError)
                        res.json({
                            Error: 'Database operation failed.'
                        });
                    else {
                        /*res.json({
                            original_url: result.url,
                            short_url: localhost + short
                        });*/
                        res.redirect(result.url);
                    }
                } else
                    res.json({
                        Error: 'Both original url and short url are not valid!'
                    });
            })
        } else {
            res.json({
                Error: 'Both original url and short url are not valid!'
            });
        }
    }
});

app.listen(process.env.PORT || 8080, () => console.log('app is running!'));