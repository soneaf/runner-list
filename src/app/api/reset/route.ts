import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextResponse } from 'next/server';

const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
    ],
});

async function getDoc(req: Request) {
    let sheetId = process.env.GOOGLE_SHEET_ID;
    const customId = req.headers.get('x-custom-sheet-id');
    if (customId && customId.length > 10) {
        sheetId = customId;
    }
    if (!sheetId) throw new Error('No Sheet ID provided');

    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();
    return doc;
}

export async function POST(req: Request) {
    try {
        const doc = await getDoc(req);

        // 1. Clear Requests (First Sheet)
        const requestSheet = doc.sheetsByIndex[0];
        try {
            await requestSheet.loadHeaderRow();
            const reqHeaders = requestSheet.headerValues;
            if (reqHeaders && reqHeaders.length > 0) {
                await requestSheet.clear(); // Wipes data and headers
                await requestSheet.setHeaderRow(reqHeaders); // Restore headers
            }
        } catch (e) {
            console.warn('Error clearing request sheet:', e);
        }

        // 2. Clear Runners
        const runnerSheet = doc.sheetsByTitle['Runners'];
        if (runnerSheet) {
            try {
                await runnerSheet.loadHeaderRow();
                const runHeaders = runnerSheet.headerValues;
                if (runHeaders && runHeaders.length > 0) {
                    await runnerSheet.clear();
                    await runnerSheet.setHeaderRow(runHeaders);
                }
            } catch (e) {
                console.warn('Error clearing runner sheet:', e);
            }
        }

        // 3. Clear Departments
        const deptSheet = doc.sheetsByTitle['Departments'];
        if (deptSheet) {
            try {
                await deptSheet.loadHeaderRow();
                const deptHeaders = deptSheet.headerValues;
                if (deptHeaders && deptHeaders.length > 0) {
                    await deptSheet.clear();
                    await deptSheet.setHeaderRow(deptHeaders);
                }
            } catch (e) {
                console.warn('Error clearing department sheet:', e);
            }
        }

        return NextResponse.json({ success: true, message: 'Factory reset complete' });
    } catch (error) {
        console.error('Reset error:', error);
        return NextResponse.json({ error: 'Failed to reset data' }, { status: 500 });
    }
}
