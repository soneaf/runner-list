
import { google } from 'googleapis';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextResponse } from 'next/server';

// Reuse the auth logic if possible, or duplicate for this endpoint speed
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Helper for Multi-Tenancy
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

export async function GET(req: Request) {
    try {
        const doc = await getDoc(req);

        // Fetch Runners
        let runners: any[] = [];
        const runnerSheet = doc.sheetsByTitle['Runners'];
        if (runnerSheet) {
            const runnerRows = await runnerSheet.getRows();
            runners = runnerRows.map(row => ({ name: row.get('Name'), phone: row.get('Phone') }));
        }

        // Fetch Departments
        let departments: string[] = [];
        let deptSheet = doc.sheetsByTitle['Departments'];
        if (!deptSheet) {
            // Create "Departments" sheet if missing & seed defaults
            deptSheet = await doc.addSheet({ title: 'Departments', headerValues: ['Name'] });
            await deptSheet.addRows([
                { Name: 'Audio' }, { Name: 'Lighting' }, { Name: 'Video' },
                { Name: 'Production' }, { Name: 'Catering' }, { Name: 'Wardrobe' }
            ]);
            departments = ['Audio', 'Lighting', 'Video', 'Production', 'Catering', 'Wardrobe'];
        } else {
            const deptRows = await deptSheet.getRows();
            departments = deptRows.map(r => r.get('Name')).filter(n => n);
        }

        // Check Schedule for Today
        let todayInfo = null;
        const scheduleSheet = doc.sheetsByTitle['Schedule'];
        if (scheduleSheet) {
            const scheduleRows = await scheduleSheet.getRows();
            // Fix: Format as "Fri Jan 16" to match Google Sheet text format
            const rawDate = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            }).format(new Date());

            // Remove comma -> "Fri Jan 16"
            const todayStr = rawDate.replace(/,/g, '');

            console.log(`Looking for schedule on: ${todayStr}`);

            // Debug Log
            if (scheduleRows.length > 0) {
                console.log('Dates in sheet:', scheduleRows.slice(0, 5).map(r => r.get('Date')));
            }

            const found = scheduleRows.find(r => r.get('Date') === todayStr);
            if (found) {
                todayInfo = { City: found.get('City'), Venue: found.get('Venue'), Date: todayStr };
            }
        }

        // Fetch Fun Facts
        let funFacts: string[] = [];
        const factsSheet = doc.sheetsByTitle['Fun Facts'];
        if (factsSheet) {
            const factRows = await factsSheet.getRows();
            funFacts = factRows.map(r => r.get('Fun Facts')).filter(f => f); // Filter out empty
        }

        return NextResponse.json({ runners, departments, todayInfo, funFacts, serviceEmail: auth.email });
    } catch (error) {
        console.error('Settings API Error', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const doc = await getDoc(req);

        if (body.type === 'runner') {
            const sheet = doc.sheetsByTitle['Runners'];
            await sheet.addRow({ Name: body.name, Phone: body.phone });
        }

        if (body.type === 'department') {
            let sheet = doc.sheetsByTitle['Departments'];
            if (!sheet) sheet = await doc.addSheet({ title: 'Departments', headerValues: ['Name'] });
            await sheet.addRow({ Name: body.name });
        }

        if (body.type === 'schedule_bulk') {
            const sheet = doc.sheetsByTitle['Schedule'];
            await sheet.addRows(body.rows);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Settings POST Error', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const name = searchParams.get('name');
        const type = searchParams.get('type') || 'runner'; // Default to runner for legacy calls

        if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

        const doc = await getDoc(req);

        if (type === 'department') {
            const sheet = doc.sheetsByTitle['Departments'];
            if (sheet) {
                const rows = await sheet.getRows();
                const rowToDelete = rows.find(r => r.get('Name') === name);
                if (rowToDelete) await rowToDelete.delete();
            }
            return NextResponse.json({ success: true });
        }

        // Default: Delete Runner
        const sheet = doc.sheetsByTitle['Runners'];
        const rows = await sheet.getRows();
        const rowToDelete = rows.find(r => r.get('Name') === name);
        if (rowToDelete) {
            await rowToDelete.delete();
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    } catch (error) {
        console.error('Settings DELETE Error', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
