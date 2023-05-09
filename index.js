import axios from 'axios';
import express from 'express';
import { createWriteStream } from 'fs';
import moment from "moment";
import pdf2html from 'pdf2html';

const BASE_ELECTRICITY_URL = 'https://cdn.eneco.be/downloads/fr/general/tk/BC_032_01@YY@@MM@_FR_ENECO_POWER_FLEX.pdf'

const app = express()
const port = process.env.PORT || 3000;

function downloadFile(year, month) {
    const dest = `./${year}-${month}.pdf`;
    const writer = createWriteStream(dest);

    return axios({
        method: 'get',
        url: BASE_ELECTRICITY_URL.replace('@YY@', year).replace('@MM@', month),
        responseType: 'stream',
    }).then(response => {
        return new Promise((resolve, reject) => {
            response.data.pipe(writer);
            let error = null;
            writer.on('error', err => {
                error = err;
                writer.close();
                reject(err);
            });
            writer.on('close', () => {
                if (!error) {
                    resolve(dest);
                }
                //no need to call the reject here, as it will have been called in the
                //'error' stream;
            });
        });
    });
}

async function parseTrimestrialTariff(dest) {
    const raw = await pdf2html.text(dest);
    const arr = raw.split('\n').filter(l => l !== '').find(l => l.toLowerCase().includes('tarif mensuel')).split(' ').map(el => el.replace(',', '.'));
    const dayTariff = parseFloat(arr[1]);
    const nightTariff = parseFloat(arr[2]);
    return { peak: dayTariff, offpeak: nightTariff };
}

const fetchTariffs = async () => {
    const month = process.argv.find(a => a.includes('month'))?.split('=')[1].padStart(2, '0') || moment().format('MM');
    const year = process.argv.find(a => a.includes('year'))?.split('=')[1].slice(-2) || moment().format('YY');
    console.log(`Fetching prices for ${month}-${year}`);
    const dest = await downloadFile(year, month);
    const tariffs = await parseTrimestrialTariff(dest);
    console.log(tariffs.peak, tariffs.offpeak);
    return tariffs;
};

app.get('/', async (req, res) => {
    const data = await fetchTariffs();
    return res.status(200).json(data);
})

app.listen(port, () => {
    console.log(`Eneco parser app listening on port ${port}`)
})
