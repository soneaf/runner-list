/* eslint-disable jsx-a11y/alt-text */
'use client';
import { Document, Page, Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer';

// --- STYLES ---
const styles = StyleSheet.create({
    page: {
        backgroundColor: '#0B0F19', // Dark Navy Background
        fontFamily: 'Helvetica',
        color: '#FFFFFF',
        padding: 80, // High padding for large canvas
    },

    // --- HEADER SECTION ---
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 60,
    },
    headerTitle: {
        fontSize: 64,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 10,
        lineHeight: 1,
    },
    headerSub: {
        fontSize: 32,
        color: '#8B949E', // Light Gray
    },
    headerRight: {
        alignItems: 'flex-end', // Ensures right alignment of the block
    },

    // --- LIST CONTAINER (Dashed Box) ---
    listContainer: {
        borderWidth: 3,
        borderColor: '#2F363D',
        borderStyle: 'dashed',
        borderRadius: 40,
        padding: 60,
        flexGrow: 1,
        marginBottom: 40,
    },

    // --- LIST ROWS ---
    row: {
        marginBottom: 40,
        paddingBottom: 40,
        borderBottomWidth: 2,
        borderBottomColor: '#21262D',
    },
    itemTitle: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 15,
    },
    itemStore: {
        fontSize: 32,
        color: '#818CF8', // Indigo-400 for visibility on dark bg
        marginBottom: 10,
        fontWeight: 'bold',
    },
    itemSub: {
        fontSize: 28,
        color: '#8B949E',
    },

    // --- FOOTER (Fun Fact Pill) ---
    funFactContainer: {
        borderWidth: 3,
        borderColor: '#2F363D',
        borderStyle: 'dashed',
        borderRadius: 60,
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        height: 300,
        marginBottom: 40,
    },
    funFactText: {
        fontSize: 32,
        color: '#FFFFFF',
        fontStyle: 'italic',
        textAlign: 'center',
    },

    // --- BOTTOM WATERMARK ---
    bottomTimestamp: {
        textAlign: 'center',
        color: '#2F363D',
        fontSize: 24,
    },
    itemImage: {
        width: 300,
        height: 300,
        objectFit: 'contain',
        borderRadius: 15,
    }
});

// --- COMPONENT ---
export const RunnerPdf = ({ runnerName, items, funFact, venueName, listNumber }: { runnerName: string, items: any[], funFact?: string, venueName?: string, listNumber?: string }) => {
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = new Date().toLocaleTimeString();

    return (
        <Document>
            {/* Custom Size: 1440 x 3200 */}
            <Page size={[1440, 3200]} style={styles.page}>

                {/* Header */}
                <View style={styles.headerContainer}>
                    <View>
                        <Text style={styles.headerTitle}>Runner List - {listNumber || '01'}</Text>
                        <Text style={styles.headerSub}>{runnerName || 'Unassigned'}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.headerTitle}>{dateStr}</Text>
                        <Text style={styles.headerSub}>{venueName || 'Tour Venue'}</Text>
                    </View>
                </View>

                {/* List Box */}
                <View style={styles.listContainer}>
                    {items.map((item, index) => {
                        // Split Item Name and Details
                        const [mainItem, ...detailsParts] = (item.item || '').split(' - ');
                        const details = detailsParts.join(' - ');

                        const isAsap = mainItem.toUpperCase().includes('ASAP');
                        const cleanTitle = mainItem.replace(/🚨?\s*ASAP\s*[-:]?\s*/i, '').trim();

                        return (
                            <View key={index} style={styles.row}>
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>

                                    {/* Left Content (Text) */}
                                    <View style={{ flex: 1, paddingRight: 20 }}>
                                        <Text style={{ ...styles.itemTitle, color: isAsap ? '#EF4444' : '#FFFFFF' }}>
                                            {index + 1}. {cleanTitle}
                                        </Text>

                                        {(() => {
                                            const urlRegex = /(?:Link:\s*)?(https?:\/\/[^\s]+)/i;
                                            const match = details ? details.match(urlRegex) : null;
                                            const itemUrl = match ? match[1] : null;
                                            let cleanDetails = (match && details) ? details.replace(urlRegex, '').trim() : (details || '');
                                            cleanDetails = cleanDetails.replace(/\s*-\s*$/, '');

                                            return (
                                                <>
                                                    {cleanDetails && (
                                                        <Text style={{ ...styles.itemSub, color: '#9CA3AF', marginBottom: 15, fontSize: 32 }}>
                                                            {cleanDetails.trim()}
                                                        </Text>
                                                    )}
                                                    {itemUrl && (
                                                        <Link src={itemUrl} style={{ ...styles.itemStore, color: '#3B82F6', textDecoration: 'none', marginBottom: 15, fontSize: 32 }}>
                                                            View Link
                                                        </Link>
                                                    )}
                                                </>
                                            );
                                        })()}

                                        {item.store && (
                                            <Text style={styles.itemStore}>Suggested Store: {item.store}</Text>
                                        )}

                                        <Text style={styles.itemSub}>
                                            Req by: {item.name} {item.phone ? `- ${item.phone}` : ''}
                                        </Text>
                                    </View>

                                    {/* Right Content (Image) */}
                                    {item.image_url && (
                                        <View style={{ marginLeft: 40 }}>
                                            <Image
                                                style={styles.itemImage}
                                                src={(() => {
                                                    // Handle different URL formats
                                                    if (item.image_url.startsWith('http')) {
                                                        return item.image_url;
                                                    }
                                                    // For local images, construct full URL
                                                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                                                    return baseUrl + item.image_url;
                                                })()}
                                            />
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })}

                    {items.length === 0 && (
                        <Text style={{ ...styles.headerSub, textAlign: 'center', marginTop: 100 }}>
                            No items assigned.
                        </Text>
                    )}
                </View>

                {/* Footer Pill */}
                <View style={styles.funFactContainer}>
                    <Text style={styles.funFactText}>“{funFact || "Production is the best department."}”</Text>
                </View>

                {/* Bottom Timestamp */}
                <Text style={styles.bottomTimestamp}>Generated: {dateStr}, {timeStr}</Text>

            </Page>
        </Document>
    );
};
