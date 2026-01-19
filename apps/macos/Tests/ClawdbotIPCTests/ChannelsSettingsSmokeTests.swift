import ClawdbotProtocol
import SwiftUI
import Testing
@testable import Clawdbot

@Suite(.serialized)
@MainActor
<<<<<<< HEAD:apps/macos/Tests/ClawdbotIPCTests/ConnectionsSettingsSmokeTests.swift
<<<<<<< HEAD
struct ConnectionsSettingsSmokeTests {
    @Test func connectionsSettingsBuildsBodyWithSnapshot() {
        let store = ConnectionsStore(isPreview: true)
        store.snapshot = ProvidersStatusSnapshot(
            ts: 1_700_000_000_000,
            whatsapp: ProvidersStatusSnapshot.WhatsAppStatus(
                configured: true,
                linked: true,
                authAgeMs: 86_400_000,
                self: ProvidersStatusSnapshot.WhatsAppSelf(
                    e164: "+15551234567",
                    jid: nil),
                running: true,
                connected: false,
                lastConnectedAt: 1_700_000_000_000,
                lastDisconnect: ProvidersStatusSnapshot.WhatsAppDisconnect(
                    at: 1_700_000_050_000,
                    status: 401,
                    error: "logged out",
                    loggedOut: true),
                reconnectAttempts: 2,
                lastMessageAt: 1_700_000_060_000,
                lastEventAt: 1_700_000_060_000,
                lastError: "needs login"),
            telegram: ProvidersStatusSnapshot.TelegramStatus(
                configured: true,
                tokenSource: "env",
                running: true,
                mode: "polling",
                lastStartAt: 1_700_000_000_000,
                lastStopAt: nil,
                lastError: nil,
                probe: ProvidersStatusSnapshot.TelegramProbe(
                    ok: true,
                    status: 200,
                    error: nil,
                    elapsedMs: 120,
                    bot: ProvidersStatusSnapshot.TelegramBot(id: 123, username: "clawdbotbot"),
                    webhook: ProvidersStatusSnapshot.TelegramWebhook(
                        url: "https://example.com/hook",
                        hasCustomCert: false)),
                lastProbeAt: 1_700_000_050_000),
            discord: nil,
            signal: ProvidersStatusSnapshot.SignalStatus(
                configured: true,
                baseUrl: "http://127.0.0.1:8080",
                running: true,
                lastStartAt: 1_700_000_000_000,
                lastStopAt: nil,
                lastError: nil,
                probe: ProvidersStatusSnapshot.SignalProbe(
                    ok: true,
                    status: 200,
                    error: nil,
                    elapsedMs: 140,
                    version: "0.12.4"),
                lastProbeAt: 1_700_000_050_000),
            imessage: ProvidersStatusSnapshot.IMessageStatus(
                configured: false,
                running: false,
                lastStartAt: nil,
                lastStopAt: nil,
                lastError: "not configured",
                cliPath: nil,
                dbPath: nil,
                probe: ProvidersStatusSnapshot.IMessageProbe(ok: false, error: "imsg not found (imsg)"),
                lastProbeAt: 1_700_000_050_000))
=======
    struct ConnectionsSettingsSmokeTests {
        @Test func connectionsSettingsBuildsBodyWithSnapshot() {
            let store = ConnectionsStore(isPreview: true)
            store.snapshot = ChannelsStatusSnapshot(
                ts: 1_700_000_000_000,
                channelOrder: ["whatsapp", "telegram", "signal", "imessage"],
                channelLabels: [
                    "whatsapp": "WhatsApp",
                    "telegram": "Telegram",
                    "signal": "Signal",
                    "imessage": "iMessage",
                ],
                channels: [
                    "whatsapp": AnyCodable([
                        "configured": true,
                        "linked": true,
=======
struct ChannelsSettingsSmokeTests {
    @Test func channelsSettingsBuildsBodyWithSnapshot() {
        let store = ChannelsStore(isPreview: true)
        store.snapshot = ChannelsStatusSnapshot(
            ts: 1_700_000_000_000,
            channelOrder: ["whatsapp", "telegram", "signal", "imessage"],
            channelLabels: [
                "whatsapp": "WhatsApp",
                "telegram": "Telegram",
                "signal": "Signal",
                "imessage": "iMessage",
            ],
            channels: [
                "whatsapp": AnyCodable([
                    "configured": true,
                    "linked": true,
>>>>>>> upstream/main:apps/macos/Tests/ClawdbotIPCTests/ChannelsSettingsSmokeTests.swift
                    "authAgeMs": 86_400_000,
                    "self": ["e164": "+15551234567"],
                    "running": true,
                    "connected": false,
                    "lastConnectedAt": 1_700_000_000_000,
                    "lastDisconnect": [
                        "at": 1_700_000_050_000,
                        "status": 401,
                        "error": "logged out",
                        "loggedOut": true,
                    ],
                    "reconnectAttempts": 2,
                    "lastMessageAt": 1_700_000_060_000,
                    "lastEventAt": 1_700_000_060_000,
                    "lastError": "needs login",
                ]),
                "telegram": AnyCodable([
                    "configured": true,
                    "tokenSource": "env",
                    "running": true,
                    "mode": "polling",
                    "lastStartAt": 1_700_000_000_000,
                    "probe": [
                        "ok": true,
                        "status": 200,
                        "elapsedMs": 120,
                        "bot": ["id": 123, "username": "clawdbotbot"],
                        "webhook": ["url": "https://example.com/hook", "hasCustomCert": false],
                    ],
                    "lastProbeAt": 1_700_000_050_000,
                ]),
                "signal": AnyCodable([
                    "configured": true,
                    "baseUrl": "http://127.0.0.1:8080",
                    "running": true,
                    "lastStartAt": 1_700_000_000_000,
                    "probe": [
                        "ok": true,
                        "status": 200,
                        "elapsedMs": 140,
                        "version": "0.12.4",
                    ],
                    "lastProbeAt": 1_700_000_050_000,
                ]),
                "imessage": AnyCodable([
                    "configured": false,
                    "running": false,
                    "lastError": "not configured",
                    "probe": ["ok": false, "error": "imsg not found (imsg)"],
                    "lastProbeAt": 1_700_000_050_000,
                ]),
            ],
            channelAccounts: [:],
            channelDefaultAccountId: [
                "whatsapp": "default",
                "telegram": "default",
                "signal": "default",
                "imessage": "default",
            ])
>>>>>>> upstream/main

        store.whatsappLoginMessage = "Scan QR"
        store.whatsappLoginQrDataUrl =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ay7pS8AAAAASUVORK5CYII="

        let view = ChannelsSettings(store: store)
        _ = view.body
    }

<<<<<<< HEAD:apps/macos/Tests/ClawdbotIPCTests/ConnectionsSettingsSmokeTests.swift
<<<<<<< HEAD
    @Test func connectionsSettingsBuildsBodyWithoutSnapshot() {
        let store = ConnectionsStore(isPreview: true)
        store.snapshot = ProvidersStatusSnapshot(
            ts: 1_700_000_000_000,
            whatsapp: ProvidersStatusSnapshot.WhatsAppStatus(
                configured: false,
                linked: false,
                authAgeMs: nil,
                self: nil,
                running: false,
                connected: false,
                lastConnectedAt: nil,
                lastDisconnect: nil,
                reconnectAttempts: 0,
                lastMessageAt: nil,
                lastEventAt: nil,
                lastError: nil),
            telegram: ProvidersStatusSnapshot.TelegramStatus(
                configured: false,
                tokenSource: nil,
                running: false,
                mode: nil,
                lastStartAt: nil,
                lastStopAt: nil,
                lastError: "bot missing",
                probe: ProvidersStatusSnapshot.TelegramProbe(
                    ok: false,
                    status: 403,
                    error: "unauthorized",
                    elapsedMs: 120,
                    bot: nil,
                    webhook: nil),
                lastProbeAt: 1_700_000_100_000),
            discord: nil,
            signal: ProvidersStatusSnapshot.SignalStatus(
                configured: false,
                baseUrl: "http://127.0.0.1:8080",
                running: false,
                lastStartAt: nil,
                lastStopAt: nil,
                lastError: "not configured",
                probe: ProvidersStatusSnapshot.SignalProbe(
                    ok: false,
                    status: 404,
                    error: "unreachable",
                    elapsedMs: 200,
                    version: nil),
                lastProbeAt: 1_700_000_200_000),
            imessage: ProvidersStatusSnapshot.IMessageStatus(
                configured: false,
                running: false,
                lastStartAt: nil,
                lastStopAt: nil,
                lastError: "not configured",
                cliPath: "imsg",
                dbPath: nil,
                probe: ProvidersStatusSnapshot.IMessageProbe(ok: false, error: "imsg not found (imsg)"),
                lastProbeAt: 1_700_000_200_000))
=======
        @Test func connectionsSettingsBuildsBodyWithoutSnapshot() {
            let store = ConnectionsStore(isPreview: true)
            store.snapshot = ChannelsStatusSnapshot(
                ts: 1_700_000_000_000,
                channelOrder: ["whatsapp", "telegram", "signal", "imessage"],
                channelLabels: [
                    "whatsapp": "WhatsApp",
                    "telegram": "Telegram",
                    "signal": "Signal",
                    "imessage": "iMessage",
                ],
                channels: [
                    "whatsapp": AnyCodable([
                        "configured": false,
                        "linked": false,
=======
    @Test func channelsSettingsBuildsBodyWithoutSnapshot() {
        let store = ChannelsStore(isPreview: true)
        store.snapshot = ChannelsStatusSnapshot(
            ts: 1_700_000_000_000,
            channelOrder: ["whatsapp", "telegram", "signal", "imessage"],
            channelLabels: [
                "whatsapp": "WhatsApp",
                "telegram": "Telegram",
                "signal": "Signal",
                "imessage": "iMessage",
            ],
            channels: [
                "whatsapp": AnyCodable([
                    "configured": false,
                    "linked": false,
>>>>>>> upstream/main:apps/macos/Tests/ClawdbotIPCTests/ChannelsSettingsSmokeTests.swift
                    "running": false,
                    "connected": false,
                    "reconnectAttempts": 0,
                ]),
                "telegram": AnyCodable([
                    "configured": false,
                    "running": false,
                    "lastError": "bot missing",
                    "probe": [
                        "ok": false,
                        "status": 403,
                        "error": "unauthorized",
                        "elapsedMs": 120,
                    ],
                    "lastProbeAt": 1_700_000_100_000,
                ]),
                "signal": AnyCodable([
                    "configured": false,
                    "baseUrl": "http://127.0.0.1:8080",
                    "running": false,
                    "lastError": "not configured",
                    "probe": [
                        "ok": false,
                        "status": 404,
                        "error": "unreachable",
                        "elapsedMs": 200,
                    ],
                    "lastProbeAt": 1_700_000_200_000,
                ]),
                "imessage": AnyCodable([
                    "configured": false,
                    "running": false,
                    "lastError": "not configured",
                    "cliPath": "imsg",
                    "probe": ["ok": false, "error": "imsg not found (imsg)"],
                    "lastProbeAt": 1_700_000_200_000,
                ]),
            ],
            channelAccounts: [:],
            channelDefaultAccountId: [
                "whatsapp": "default",
                "telegram": "default",
                "signal": "default",
                "imessage": "default",
            ])
>>>>>>> upstream/main

        let view = ChannelsSettings(store: store)
        _ = view.body
    }
}
