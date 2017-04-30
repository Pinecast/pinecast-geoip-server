'use strict';

const bodyParser = require('body-parser');
const express = require('express');
const irc = require('ip-range-check');
const maxmind = require('maxmind');


const app = express();
app.use(bodyParser.json());

const cityData = maxmind.openSync(process.env.MM_CITY || '/var/data/geoip/city.mmdb');
const awsRanges = require('./aws-ranges.json').prefixes.filter(x => x.ip_prefix);
const awsIpPrefixes = awsRanges.map(x => x.ip_prefix);


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

        let cityName = data.city && data.city.names && (data.city.names.en || data.city.names[Object.keys(data.city.names)[0]]);
        if (cityName && data.subdivisions && data.subdivisions.length) {
            const sd = data.subdivisions[0];
            if (sd.names && sd.names.en) {
                cityName = `${cityName}, ${sd.names.en}`;
            }
        }

        const isDataCenter = irc(x, awsIpPrefixes);

        return cache[x] = {
            city: cityName,
            // country: data.country.names.en || data.country.names[Object.keys(data.country.names)[0]],
            code: data.country && data.country.iso_code || null,
            zip: data.postal && data.postal.code || null,
            lat: data.location && data.location.latitude && data.location.latitude.toFixed && data.location.latitude.toFixed(3),
            lon: data.location && data.location.longitude && data.location.longitude.toFixed && data.location.longitude.toFixed(3),
            dc: isDataCenter,
        };
    }));
});


app.listen(process.env.PORT || 3001);
