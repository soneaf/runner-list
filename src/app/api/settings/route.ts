
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
            runners = runnerRows.map(row => ({
                name: row.get('Name'),
                phone: row.get('Phone'),
                city: row.get('City') || '',
                active: row.get('Active') !== 'FALSE', // Default to TRUE if missing or anything else
                cash: !isNaN(parseFloat(row.get('Cash'))) ? parseFloat(row.get('Cash')) : 0, // Allow 0
                contactType: row.get('ContactType') || 'cell', // Default to cell
                color: row.get('Color') || null
            }));
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

        // Check Schedule for Today + Fetch Full Schedule
        let todayInfo = null;
        let schedule: any[] = [];
        const scheduleSheet = doc.sheetsByTitle['Schedule'];
        if (scheduleSheet) {
            const scheduleRows = await scheduleSheet.getRows();

            // Build full schedule array
            schedule = scheduleRows.map(r => ({
                date: r.get('Date'),
                city: r.get('City'),
                venue: r.get('Venue')
            })).filter(r => r.date); // Filter out empty rows

            // Helper to normalize any date to comparable format
            const normalizeDate = (dateStr: string): string => {
                if (!dateStr) return '';
                const clean = dateStr.trim();

                // 1. If already YYYY-MM-DD, return it to prevent timezone shifting
                if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

                try {
                    let processedDate = clean;
                    const currentYear = new Date().getFullYear();

                    // Check if date already has a 4-digit year
                    const hasYear = /\b(20\d{2}|19\d{2})\b/.test(processedDate);
                    if (!hasYear) {
                        // Append current year for dates like "Fri Jan 16" or "Feb 4"
                        processedDate = `${processedDate}, ${currentYear}`;
                    }

                    const parsed = new Date(processedDate);
                    if (isNaN(parsed.getTime())) return clean.toLowerCase();

                    // Return as "2026-02-04" format using local components (works for M/D/Y)
                    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
                } catch {
                    return clean.toLowerCase();
                }
            };

            // Get today in EST timezone
            const now = new Date();
            const estOptions = { timeZone: 'America/New_York' };
            const estDate = new Date(now.toLocaleString('en-US', estOptions));
            const todayNormalized = `${estDate.getFullYear()}-${String(estDate.getMonth() + 1).padStart(2, '0')}-${String(estDate.getDate()).padStart(2, '0')}`;

            console.log(`Looking for schedule on (normalized): ${todayNormalized}`);

            // Debug Log
            if (scheduleRows.length > 0) {
                console.log('First 5 dates in sheet:', scheduleRows.slice(0, 5).map(r => r.get('Date')));
                console.log('First 5 normalized:', scheduleRows.slice(0, 5).map(r => normalizeDate(r.get('Date'))));
            }

            // Find matching date
            const found = scheduleRows.find(r => {
                const sheetDate = normalizeDate(r.get('Date'));
                return sheetDate === todayNormalized;
            });

            if (found) {
                todayInfo = { City: found.get('City'), Venue: found.get('Venue'), Date: found.get('Date') };
                console.log('Found today:', todayInfo);
            } else {
                console.log('No match found for today');
            }
        }

        // Fetch Fun Facts
        let funFacts: string[] = [];
        const factsSheet = doc.sheetsByTitle['Fun Facts'];
        if (factsSheet) {
            const factRows = await factsSheet.getRows();
            funFacts = factRows.map(r => r.get('Fun Facts')).filter(f => f); // Filter out empty
        }

        return NextResponse.json({ runners, departments, todayInfo, schedule, funFacts, serviceEmail: auth.email });
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

            // Ensure headers exist
            await sheet.loadHeaderRow();
            const headers = sheet.headerValues;
            let newHeaders = [...headers];
            if (!headers.includes('City')) newHeaders.push('City');
            if (!headers.includes('Active')) newHeaders.push('Active');
            if (!headers.includes('Cash')) newHeaders.push('Cash');
            if (!headers.includes('ContactType')) newHeaders.push('ContactType');
            if (!headers.includes('Color')) newHeaders.push('Color');
            if (newHeaders.length > headers.length) await sheet.setHeaderRow(newHeaders);

            await sheet.addRow({
                Name: body.name,
                Phone: body.phone,
                City: body.city || '',
                Active: 'TRUE',
                Cash: body.cash ?? 0,
                ContactType: body.contactType || 'cell',
                Color: body.color || ''
            });
        }

        if (body.type === 'toggle_runner') {
            const sheet = doc.sheetsByTitle['Runners'];
            const rows = await sheet.getRows();
            const row = rows.find(r => r.get('Name') === body.name);
            if (row) {
                row.assign({ Active: body.active ? 'TRUE' : 'FALSE' });
                await row.save();
            }
        }

        // Update Runner Cash
        if (body.type === 'update_runner_cash') {
            const sheet = doc.sheetsByTitle['Runners'];
            if (sheet) {
                // Ensure Cash header exists
                await sheet.loadHeaderRow();
                const headers = sheet.headerValues;
                if (!headers.includes('Cash')) {
                    await sheet.setHeaderRow([...headers, 'Cash']);
                }

                const rows = await sheet.getRows();
                const row = rows.find(r => r.get('Name') === body.name);
                if (row) {
                    row.assign({ Cash: body.cash.toString() });
                    await row.save();
                }
            }
        }

        if (body.type === 'department') {
            let sheet = doc.sheetsByTitle['Departments'];
            if (!sheet) sheet = await doc.addSheet({ title: 'Departments', headerValues: ['Name'] });
            await sheet.addRow({ Name: body.name });
        }

        if (body.type === 'update_runner') {
            const sheet = doc.sheetsByTitle['Runners'];
            const rows = await sheet.getRows();
            const row = rows.find(r => r.get('Name') === body.originalName);
            if (row) {
                row.assign({
                    Name: body.name,
                    Phone: body.phone,
                    City: body.city || '',
                    Cash: body.cash ?? 0,
                    ContactType: body.contactType || 'cell',
                    Color: body.color || ''
                });
                await row.save();
            }
        }

        if (body.type === 'schedule_bulk') {
            let sheet = doc.sheetsByTitle['Schedule'];

            // Create sheet if it doesn't exist
            if (!sheet) {
                sheet = await doc.addSheet({ title: 'Schedule', headerValues: ['Date', 'City', 'Venue'] });
            } else {
                // Clear existing data (keep headers)
                const existingRows = await sheet.getRows();
                for (const row of existingRows) {
                    await row.delete();
                }
            }

            // Normalize dates to YYYY-MM-DD format for consistent matching
            const normalizedRows = body.rows.map((row: any) => {
                const rawDate = row.Date || row.date;
                const rawCity = row.City || row.city;
                const rawVenue = row.Venue || row.venue;

                let normalizedDate = rawDate;
                try {
                    const parsed = new Date(rawDate);
                    if (!isNaN(parsed.getTime())) {
                        // Format as YYYY-MM-DD
                        normalizedDate = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
                    }
                } catch {
                    // Keep original if parsing fails
                }
                return { Date: normalizedDate, City: rawCity, Venue: rawVenue };
            });

            // Add new rows
            await sheet.addRows(normalizedRows);
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
