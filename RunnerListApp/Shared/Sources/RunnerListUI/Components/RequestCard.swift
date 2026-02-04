import SwiftUI

// MARK: - Request Card

/// A card displaying request summary
public struct RequestCard: View {
    let request: Request
    let departmentName: String?
    let runnerName: String?
    let onTap: () -> Void

    public init(
        request: Request,
        departmentName: String? = nil,
        runnerName: String? = nil,
        onTap: @escaping () -> Void
    ) {
        self.request = request
        self.departmentName = departmentName
        self.runnerName = runnerName
        self.onTap = onTap
    }

    public var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 10) {
                // Header row
                headerRow

                // Department and location
                if let dept = departmentName {
                    Label(dept, systemImage: "building.2")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                // Footer row
                footerRow
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(cardBackground)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(borderColor, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Header Row

    private var headerRow: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(request.requesterName)
                    .font(.headline)
                    .foregroundColor(.primary)

                Text(request.requesterMobile)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            StatusBadge(status: request.status)
        }
    }

    // MARK: - Footer Row

    private var footerRow: some View {
        HStack {
            Label("\(request.itemCount) item\(request.itemCount == 1 ? "" : "s")", systemImage: "shippingbox")
                .font(.caption)
                .foregroundColor(.secondary)

            if request.hasASAPItems {
                ASAPIndicator(compact: true)
            }

            Spacer()

            if let runner = runnerName {
                RunnerBadge(name: runner)
            }

            if let cost = request.totalCost, cost > 0 {
                CostBadge(amount: cost)
            }
        }
    }

    // MARK: - Styling

    private var cardBackground: some View {
        #if os(macOS)
        Color(nsColor: .controlBackgroundColor)
        #else
        Color(uiColor: .secondarySystemGroupedBackground)
        #endif
    }

    private var borderColor: Color {
        if request.hasASAPItems {
            return AppColors.asapRed.opacity(0.5)
        }
        return AppColors.borderDefault
    }
}

// MARK: - Runner Badge

public struct RunnerBadge: View {
    let name: String

    public init(name: String) {
        self.name = name
    }

    private var initials: String {
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return "\(parts[0].prefix(1))\(parts[1].prefix(1))".uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    public var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(AppColors.statusAssigned.opacity(0.3))
                .frame(width: 20, height: 20)
                .overlay(
                    Text(initials)
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(AppColors.statusAssigned)
                )

            Text(name)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(1)
        }
    }
}

// MARK: - Cost Badge

public struct CostBadge: View {
    let amount: Double

    public init(amount: Double) {
        self.amount = amount
    }

    private var formattedAmount: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = .current
        return formatter.string(from: NSNumber(value: amount)) ?? "$\(amount)"
    }

    public var body: some View {
        Text(formattedAmount)
            .font(.caption.weight(.medium))
            .foregroundColor(AppColors.statusCompleted)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(AppColors.statusCompleted.opacity(0.15))
            .cornerRadius(4)
    }
}

// MARK: - Request Card Compact

/// A more compact version of the request card for lists
public struct RequestCardCompact: View {
    let request: Request
    let showRunner: Bool
    let runnerName: String?
    let onTap: () -> Void

    public init(
        request: Request,
        showRunner: Bool = true,
        runnerName: String? = nil,
        onTap: @escaping () -> Void
    ) {
        self.request = request
        self.showRunner = showRunner
        self.runnerName = runnerName
        self.onTap = onTap
    }

    public var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                StatusDot(status: request.status)

                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(request.requesterName)
                            .font(.subheadline.weight(.medium))

                        if request.hasASAPItems {
                            ASAPIndicator(compact: true)
                        }
                    }

                    Text("\(request.itemCount) item\(request.itemCount == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if showRunner, let runner = runnerName {
                    Text(runner)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: 16) {
            RequestCard(
                request: Request(
                    requesterName: "John Doe",
                    requesterMobile: "(555) 123-4567",
                    departmentID: "1",
                    status: .pending,
                    hasASAPItems: true,
                    itemCount: 3
                ),
                departmentName: "Audio",
                runnerName: nil
            ) {
                print("Tapped")
            }

            RequestCard(
                request: Request(
                    requesterName: "Jane Smith",
                    requesterMobile: "(555) 987-6543",
                    departmentID: "2",
                    status: .assigned,
                    hasASAPItems: false,
                    itemCount: 1
                ),
                departmentName: "Lighting",
                runnerName: "Mike Wilson"
            ) {
                print("Tapped")
            }

            RequestCard(
                request: Request(
                    requesterName: "Bob Johnson",
                    requesterMobile: "(555) 456-7890",
                    departmentID: "3",
                    status: .completed,
                    totalCost: 125.50,
                    hasASAPItems: false,
                    itemCount: 5
                ),
                departmentName: "Production",
                runnerName: "Sarah Lee"
            ) {
                print("Tapped")
            }
        }
        .padding()
    }
}
