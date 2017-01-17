'use strict';

const bodyParser = require('body-parser');
const express = require('express');
const maxmind = require('maxmind');


const app = express();
app.use(bodyParser.json());

const cityData = maxmind.openSync(process.env.MM_CITY || '/var/data/geoip/city.mmdb');


app.post('/bulk', (req, res) => {
    if (
        !Array.isArray(req.body) ||
        !req.body.every(a => typeof a === 'string') ||
        !req.body.every(a => maxmind.validate(a))
    ) {
        res.status(400).end();
        return;
    }

    const cache = {};
    res.json(req.body.map(x => {
        if (typeof cache[x] !== 'undefined') {
            return cache[x];
        }
        const data = cityData.get(x);
        if (!data || !data.country) {
            return cache[x] = null;
        }

        return cache[x] = {
            city: data.city && data.city.names && (data.city.names.en || data.city.names[Object.keys(data.city.names)[0]]),
            // country: data.country.names.en || data.country.names[Object.keys(data.country.names)[0]],
            code: data.country && data.country.iso_code || null,
            zip: data.postal && data.postal.code || null,
            lat: data.location && data.location.latitude && data.location.latitude.toFixed && data.location.latitude.toFixed(3),
            lon: data.location && data.location.longitude && data.location.longitude.toFixed && data.location.longitude.toFixed(3),
        };
    }));
});


app.listen(process.env.PORT || 3001);
