// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Shared",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "RunnerListCore",
            targets: ["RunnerListCore"]
        ),
        .library(
            name: "RunnerListUI",
            targets: ["RunnerListUI"]
        )
    ],
    targets: [
        .target(
            name: "RunnerListCore",
            dependencies: [],
            path: "Sources/RunnerListCore"
        ),
        .target(
            name: "RunnerListUI",
            dependencies: ["RunnerListCore"],
            path: "Sources/RunnerListUI"
        )
    ]
)
