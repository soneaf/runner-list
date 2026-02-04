import SwiftUI

// MARK: - App Colors

public struct AppColors {

    // MARK: - Status Colors

    public static let statusPending = Color.yellow
    public static let statusAssigned = Color.blue
    public static let statusPurchased = Color.purple
    public static let statusCompleted = Color.green

    // MARK: - Brand Colors

    public static let primaryGradientStart = Color(red: 0.4, green: 0.4, blue: 0.9) // Indigo
    public static let primaryGradientEnd = Color(red: 0.6, green: 0.3, blue: 0.8) // Purple

    public static let accentColor = Color(red: 0.4, green: 0.4, blue: 0.9)

    // MARK: - Unified Background Colors (Dark Theme)

    /// Main page/window background - pure black
    public static let backgroundPrimary = Color.black

    /// Card and field background - dark gray #2c2c2e
    public static let backgroundSecondary = Color(red: 0.173, green: 0.173, blue: 0.180)

    /// Darker variant for nested elements
    public static let backgroundTertiary = Color(red: 0.12, green: 0.12, blue: 0.14)

    /// Even darker for PDF/print backgrounds
    public static let backgroundPDF = Color(red: 0.06, green: 0.07, blue: 0.10)

    // Legacy - kept for compatibility
    public static let backgroundDark = Color(red: 0.043, green: 0.047, blue: 0.082) // #0b0c15
    public static let backgroundCard = Color(red: 0.1, green: 0.1, blue: 0.15).opacity(0.5)
    public static let backgroundCardHover = Color(red: 0.15, green: 0.15, blue: 0.2).opacity(0.5)

    // MARK: - Text Colors

    public static let textPrimary = Color.white
    public static let textSecondary = Color.gray
    public static let textMuted = Color.gray.opacity(0.7)

    // MARK: - Border Colors

    public static let borderDefault = Color.gray.opacity(0.3)
    public static let borderFocused = Color.blue.opacity(0.5)
    public static let borderASAP = Color.red.opacity(0.5)

    // MARK: - Alert Colors

    public static let asapRed = Color.red
    public static let successGreen = Color.green
    public static let warningAmber = Color.orange
    public static let errorRed = Color.red

    // MARK: - Status Color Helper

    public static func color(for status: String) -> Color {
        switch status.lowercased() {
        case "pending": return statusPending
        case "assigned": return statusAssigned
        case "purchased": return statusPurchased
        case "completed": return statusCompleted
        default: return Color.gray
        }
    }
}

// MARK: - Color Extension for RequestStatus


extension RequestStatus {
    public var color: Color {
        switch self {
        case .pending: return AppColors.statusPending
        case .assigned: return AppColors.statusAssigned
        case .purchased: return AppColors.statusPurchased
        case .completed: return AppColors.statusCompleted
        }
    }

    public var backgroundColor: Color {
        color.opacity(0.2)
    }
}

// MARK: - Gradient Definitions

public struct AppGradients {

    public static let primary = LinearGradient(
        colors: [AppColors.primaryGradientStart, AppColors.primaryGradientEnd],
        startPoint: .leading,
        endPoint: .trailing
    )

    public static let background = LinearGradient(
        colors: [
            Color(red: 0.06, green: 0.09, blue: 0.16),
            AppColors.backgroundDark
        ],
        startPoint: .top,
        endPoint: .bottom
    )

    public static let card = LinearGradient(
        colors: [
            Color.white.opacity(0.05),
            Color.white.opacity(0.02)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}
