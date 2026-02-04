
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
];

async function setupSheets() {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
        console.error('Missing env vars');
        return;
    }

    const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: SCOPES,
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();

    console.log('Document loaded:', doc.title);

    // 1. Rename/Update Requests Tab ?
    // The first sheet is usually the requests sheet.
    const requestsSheet = doc.sheetsByIndex[0];
    if (requestsSheet.title !== 'Requests') {
        console.log(`Renaming sheet '${requestsSheet.title}' to 'Requests'...`);
        await requestsSheet.updateProperties({ title: 'Requests' });
    }

    // Update Headers for Requests
    // We want to preserve existing data but add headers if missing.
    // Actually, we can just load header row.
    await requestsSheet.loadHeaderRow();
    let headers = requestsSheet.headerValues;
    const newRequestHeaders = ['Show Date', 'City', 'Venue'];
    let headersChanged = false;
    for (const h of newRequestHeaders) {
        if (!headers.includes(h)) {
            headers.push(h);
            headersChanged = true;
        }
    }
    if (headersChanged) {
        console.log('Updating Requests headers:', headers);
        await requestsSheet.setHeaderRow(headers);
    }

    // 2. Ensure Runners Tab
    let runnersSheet = doc.sheetsByTitle['Runners'];
    if (!runnersSheet) {
        console.log('Creating Runners sheet...');
        runnersSheet = await doc.addSheet({ title: 'Runners' });
        await runnersSheet.setHeaderRow(['Name', 'Phone']);
    } else {
        console.log('Runners sheet exists.');
        // Verify headers
        await runnersSheet.loadHeaderRow();
        if (!runnersSheet.headerValues.includes('Name') || !runnersSheet.headerValues.includes('Phone')) {
            await runnersSheet.setHeaderRow(['Name', 'Phone']);
        }
    }

    // 3. Ensure Schedule Tab
    let scheduleSheet = doc.sheetsByTitle['Schedule'];
    if (!scheduleSheet) {
        console.log('Creating Schedule sheet...');
        scheduleSheet = await doc.addSheet({ title: 'Schedule' });
        await scheduleSheet.setHeaderRow(['Date', 'City', 'Venue']);
    } else {
        console.log('Schedule sheet exists.');
        // Verify headers
        await scheduleSheet.loadHeaderRow();
        if (!scheduleSheet.headerValues.includes('Date')) {
            await scheduleSheet.setHeaderRow(['Date', 'City', 'Venue']);
        }
    }

    console.log('Sheets setup complete!');
}

setupSheets().catch(console.error);
