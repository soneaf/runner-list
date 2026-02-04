const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');
const fs = require('fs');

// Load environment variables for local script execution
require('dotenv').config({ path: '.env.local' });

async function addStoreColumn() {
    try {
        const auth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
            ],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

        console.log('Loading doc info...');
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        console.log('Loading headers...');
        await sheet.loadHeaderRow();
        const headers = sheet.headerValues;

        if (headers.includes('store')) {
            console.log('✅ "store" column already exists.');
        } else {
            console.log('➕ Adding "store" column...');
            const newHeaders = [...headers, 'store'];
            await sheet.setHeaderRow(newHeaders);
            console.log('✅ "store" column added successfully.');
        }

    } catch (error) {
        console.error('❌ Failed to add column:', error);
    }
}

addStoreColumn();
