import SwiftUI

// MARK: - ASAP Indicator

/// A red alert badge for urgent items
public struct ASAPIndicator: View {
    let compact: Bool

    public init(compact: Bool = false) {
        self.compact = compact
    }

    public var body: some View {
        if compact {
            compactView
        } else {
            fullView
        }
    }

    private var compactView: some View {
        Image(systemName: "exclamationmark.triangle.fill")
            .foregroundColor(AppColors.asapRed)
            .font(.caption)
    }

    private var fullView: some View {
        HStack(spacing: 4) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text("ASAP")
                .font(.caption.weight(.bold))
        }
        .foregroundColor(.white)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(AppColors.asapRed)
        .clipShape(Capsule())
    }
}

// MARK: - ASAP Text Badge

/// A text-only ASAP indicator
public struct ASAPTextBadge: View {
    public init() {}

    public var body: some View {
        Text("ASAP")
            .font(.caption2.weight(.bold))
            .foregroundColor(AppColors.asapRed)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(AppColors.asapRed.opacity(0.15))
            .cornerRadius(4)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        ASAPIndicator()
        ASAPIndicator(compact: true)
        ASAPTextBadge()
    }
    .padding()
}
