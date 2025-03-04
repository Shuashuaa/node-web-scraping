import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { describe, beforeAll, afterAll, test, expect } from 'vitest'; // Import vitest functions

dotenv.config();

const waitForFile = (filePath) => new Promise((resolve, reject) => {
    const checkFileExistence = setInterval(() => {
        if (fs.existsSync(filePath)) {
            clearInterval(checkFileExistence);
            resolve();
        }
    }, 100);
});

describe('Scraper Tests', () => {
    let browser;
    let page;

    beforeAll(async () => {
        // Launch puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        page = await browser.newPage();
    });

    afterAll(async () => {
        if (browser) {
            // Close the browser after tests
            await browser.close();
        }
    });

    const url = process.env.SCRAPER_URL;
    const searchTerm = process.env.SEARCH_TERM;
    const searchInputSelector = 'input[name="q"]';
    const searchButtonSelector = 'button.search-bar--submit';
    const productSelector = '.product-grid-item';

    test('should scrape products from the page', async () => {
        // Navigate to URL
        await page.goto(url);
        await page.waitForSelector(searchInputSelector);

        // Type in the search term and click search
        await page.type(searchInputSelector, searchTerm);
        await page.click(searchButtonSelector);
        await page.waitForNavigation({ timeout: 60000 });

        // Wait for the product grid to appear
        await page.waitForSelector(productSelector);

        // Run the evaluate function to get the scraped data
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

        // Validate that the data is scraped correctly
        expect(popLinks).toBeInstanceOf(Array);
        expect(popLinks.length).toBeGreaterThan(0); // Ensure there are products scraped
        expect(popLinks[0]).toHaveProperty('popImage');
        expect(popLinks[0]).toHaveProperty('popTitle');
        expect(popLinks[0]).toHaveProperty('popPrice');
        expect(popLinks[0]).toHaveProperty('isSoldOut');
    }, 150000);

    test('should save scraped products to a JSON file', async () => {
        const filePath = path.resolve(__dirname, 'links.json');

        // Wait for the file to be written
        await waitForFile(filePath);

        // Read the saved JSON file
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(fileContent);

        // Check if the JSON data contains the same structure
        expect(jsonData).toBeInstanceOf(Array);
        expect(jsonData.length).toBeGreaterThan(0); // Ensure there are products scraped

        // Check if the fields are correctly saved in JSON
        const firstProduct = jsonData[0];
        expect(firstProduct).toHaveProperty('popImage');
        expect(firstProduct).toHaveProperty('popTitle');
        expect(firstProduct).toHaveProperty('popPrice');
        expect(firstProduct).toHaveProperty('isSoldOut');

        // Ensure that the file was saved
        expect(fs.existsSync(filePath)).toBe(true);
        console.log('File successfully saved and verified!');
    }, 150000);

    test('should handle missing selectors gracefully', async () => {
        const invalidSearchTerm = 'nonexistentpop';

        // Navigate to URL
        await page.goto(url);
        await page.waitForSelector(searchInputSelector);

        // Type in the search term and click search
        await page.type(searchInputSelector, invalidSearchTerm);
        await page.click(searchButtonSelector);
        await page.waitForNavigation({ timeout: 60000 });

        // Wait for the product grid to appear
        await page.waitForSelector(productSelector);

        // Check that no products are loaded
        const products = await page.$$('.product-grid-item');
        expect(products.length).toBe(0);
    }, 150000);
});