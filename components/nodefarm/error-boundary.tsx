"use client";

import { Component, type ReactNode } from "react";

/**
 * Catches a render error inside the game, so the page around it still works and the player is told what happened.
 * The save lives in localStorage and this boundary never touches it, so a reload picks it up again.
 * It only sees errors thrown while rendering: an error in a timer or an event handler is not caught here.
 */
export class NodeFarmBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: unknown) {
        console.error("Node Farm stopped drawing after an error. The save is still in this browser.", error);
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div className="nf-crash" role="alert">
                <p className="nf-crash-t">node farm // stopped</p>
                <p className="nf-crash-d">The game hit an error and stopped drawing. Your save is still in this browser. Reload to pick it up.</p>
                <button type="button" className="nf-crash-go" onClick={() => window.location.reload()}>Reload</button>
            </div>
        );
    }
}
