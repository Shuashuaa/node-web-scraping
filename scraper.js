import puppeteer from 'puppeteer';
import fs from 'fs';
import dotenv from 'dotenv';
import cron from 'node-cron';
import open from 'open';
import httpServer from 'http-server';

dotenv.config();

const searchTerm = process.env.SEARCH_TERM;

let server; // Store the server reference

// Function to perform the scraping task
const scrape = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const url = process.env.SCRAPER_URL;

    await page.goto(url);

    await page.waitForSelector('input[name="q"]');
    await page.waitForSelector('button.search-bar--submit');

    await page.type('input[name="q"]', searchTerm);

    await page.click('button.search-bar--submit');

    await page.waitForNavigation();

    await page.waitForSelector('.product-grid-item');

    const popLinks = await page.evaluate(() => {
        const popsElements = document.querySelectorAll('.product-grid-item');
        return Array.from(popsElements).map((pop) => {
            const popImage = pop.querySelector('.product-grid-image img')?.getAttribute('data-srcset')?.split(',')[0].split(' ')[0].replace(/^\/\//, '') || 'No Image';
            const popTitle = pop.querySelector('p')?.textContent.trim() || 'No Title';
            const popPrice = pop.querySelector('.product-item--price small')?.textContent.trim() || 'No Price';
            const isSoldOut = pop.closest('.grid-item')?.classList.contains('sold-out') ? 'Sold Out' : 'Available';

            return {
                popImage, popTitle, popPrice, isSoldOut
            };
        });
    });

    if (fs.existsSync('links.json')) {
        fs.unlinkSync('links.json');
    }

    fs.writeFileSync('links.json', JSON.stringify(popLinks, null, 2));

    console.log(popLinks);
    console.log('Data saved to: links.json');

    await browser.close();
};

// Function to start the server
const startServer = async () => {
    try {
        const port = '8081'; // Find an available port
        const host = '192.168.1.5';

        // Close the previous server if it exists
        if (server) {
            server.close(() => {
                console.log('Previous server closed');
            });
        }

        // Start a new server
        server = httpServer.createServer({ root: '.' });

        server.listen(port, host, () => {
            console.log(`Server started on http://${host}:${port}`);
            open(`http://${host}:${port}`).catch(console.error);
        });
    } catch (error) {
        console.error(error);
    }
};

// cron job run evey 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('Running the scraper');
    await scrape();
    await startServer();
});
