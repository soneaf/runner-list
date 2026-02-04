import SwiftUI

// MARK: - Status Badge

/// A colored badge showing the request status
public struct StatusBadge: View {
    let status: RequestStatus

    public init(status: RequestStatus) {
        self.status = status
    }

    public var body: some View {
        Text(status.displayName)
            .font(.caption.weight(.semibold))
            .foregroundColor(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(status.color)
            .clipShape(Capsule())
    }
}

// MARK: - Mini Status Badge

/// A smaller status indicator dot
public struct StatusDot: View {
    let status: RequestStatus

    public init(status: RequestStatus) {
        self.status = status
    }

    public var body: some View {
        Circle()
            .fill(status.color)
            .frame(width: 8, height: 8)
    }
}

// MARK: - Status Row

/// A row showing status with label
public struct StatusRow: View {
    let status: RequestStatus
    let showLabel: Bool

    public init(status: RequestStatus, showLabel: Bool = true) {
        self.status = status
        self.showLabel = showLabel
    }

    public var body: some View {
        HStack(spacing: 6) {
            StatusDot(status: status)
            if showLabel {
                Text(status.displayName)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        ForEach(RequestStatus.allCases, id: \.self) { status in
            HStack {
                StatusBadge(status: status)
                Spacer()
                StatusRow(status: status)
            }
            .padding(.horizontal)
        }
    }
    .padding()
}
