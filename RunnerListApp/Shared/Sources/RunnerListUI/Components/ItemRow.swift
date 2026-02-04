import SwiftUI

// MARK: - Item Row

/// A row displaying a single request item
public struct ItemRow: View {
    let item: RequestItem
    let showActions: Bool
    let onMarkPurchased: (() -> Void)?
    let onOpenLink: (() -> Void)?

    public init(
        item: RequestItem,
        showActions: Bool = true,
        onMarkPurchased: (() -> Void)? = nil,
        onOpenLink: (() -> Void)? = nil
    ) {
        self.item = item
        self.showActions = showActions
        self.onMarkPurchased = onMarkPurchased
        self.onOpenLink = onOpenLink
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            headerRow

            // Description
            if let desc = item.itemDescription, !desc.isEmpty {
                Text(desc)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(3)
            }

            // Store and link
            infoRow

            // Actions
            if showActions && !item.isPurchased {
                actionRow
            }

            // Cost (if purchased)
            if item.isPurchased, let cost = item.actualCost {
                purchasedRow(cost: cost)
            }
        }
        .padding()
        .background(rowBackground)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(borderColor, lineWidth: item.isASAP ? 2 : 1)
        )
    }

    // MARK: - Header Row

    private var headerRow: some View {
        HStack {
            Text(item.itemName)
                .font(.headline)
                .foregroundColor(item.isASAP ? AppColors.asapRed : .primary)

            if item.isASAP {
                ASAPTextBadge()
            }

            Spacer()

            if item.isPurchased {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(AppColors.statusCompleted)
            }
        }
    }

    // MARK: - Info Row

    private var infoRow: some View {
        HStack(spacing: 12) {
            if let store = item.storeName, !store.isEmpty {
                Label(store, systemImage: "storefront")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if item.itemLink != nil {
                Button(action: { onOpenLink?() }) {
                    Label("View Link", systemImage: "link")
                        .font(.caption)
                        .foregroundColor(AppColors.accentColor)
                }
                .buttonStyle(.plain)
            }

            if item.imageAssetID != nil {
                Label("Photo", systemImage: "photo")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
    }

    // MARK: - Action Row

    private var actionRow: some View {
        HStack {
            Spacer()

            Button(action: { onMarkPurchased?() }) {
                Label("Mark Purchased", systemImage: "bag.badge.plus")
                    .font(.subheadline.weight(.medium))
            }
            .buttonStyle(.borderedProminent)
            .tint(AppColors.statusPurchased)
        }
    }

    // MARK: - Purchased Row

    private func purchasedRow(cost: Double) -> some View {
        HStack {
            Label("Purchased", systemImage: "checkmark.circle")
                .font(.caption)
                .foregroundColor(AppColors.statusCompleted)

            Spacer()

            CostBadge(amount: cost)
        }
        .padding(.top, 4)
    }

    // MARK: - Styling

    private var rowBackground: some View {
        #if os(macOS)
        Color(nsColor: .controlBackgroundColor).opacity(0.5)
        #else
        Color(uiColor: .tertiarySystemGroupedBackground)
        #endif
    }

    private var borderColor: Color {
        if item.isASAP {
            return AppColors.asapRed.opacity(0.5)
        }
        return AppColors.borderDefault
    }
}

// MARK: - Item Row Compact

/// A compact version for lists
public struct ItemRowCompact: View {
    let item: RequestItem
    let onTap: () -> Void

    public init(item: RequestItem, onTap: @escaping () -> Void) {
        self.item = item
        self.onTap = onTap
    }

    public var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Status indicator
                Circle()
                    .fill(item.isPurchased ? AppColors.statusCompleted : Color.gray.opacity(0.3))
                    .frame(width: 10, height: 10)

                // Item info
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(item.itemName)
                            .font(.subheadline.weight(.medium))
                            .foregroundColor(item.isASAP ? AppColors.asapRed : .primary)

                        if item.isASAP {
                            ASAPIndicator(compact: true)
                        }
                    }

                    if let store = item.storeName {
                        Text(store)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                // Cost or chevron
                if let cost = item.actualCost {
                    CostBadge(amount: cost)
                } else {
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: 12) {
            ItemRow(
                item: RequestItem(
                    requestID: "1",
                    itemName: "XLR Cables (25ft)",
                    itemDescription: "Need 10 male-to-female cables for stage setup",
                    storeName: "Guitar Center",
                    isASAP: true
                ),
                onMarkPurchased: { print("Mark purchased") },
                onOpenLink: nil
            )

            ItemRow(
                item: RequestItem(
                    requestID: "1",
                    itemName: "Gaffer Tape",
                    itemDescription: nil,
                    itemLink: URL(string: "https://amazon.com"),
                    storeName: "Amazon",
                    isASAP: false,
                    isPurchased: true,
                    actualCost: 24.99
                ),
                onMarkPurchased: nil,
                onOpenLink: { print("Open link") }
            )

            Divider()

            ItemRowCompact(
                item: RequestItem(
                    requestID: "1",
                    itemName: "Water Bottles (Case)",
                    storeName: "Costco",
                    isASAP: false
                )
            ) {
                print("Tapped")
            }
        }
        .padding()
    }
}
