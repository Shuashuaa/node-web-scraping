import puppeteer from "puppeteer";
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const searchTerm = process.env.SEARCH_TERM;

const scrape = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const url = process.env.SCRAPER_URL;

    try {
        await page.goto(url, { timeout: 60000 })

        await page.waitForSelector('input[name="q"]');
        await page.waitForSelector('button.search-bar--submit');

        await page.type('input[name="q"]', searchTerm);

        await page.click('button.search-bar--submit');

        await page.waitForNavigation({ timeout: 60000 });

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

    } catch (error) {
        console.error('Scraping error:', error);
    } finally {
        await browser.close();
    }
};

scrape();