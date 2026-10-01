// components/ErrorBoundary.js
// What someone sees when a screen crashes, instead of a white rectangle.
//
// A React render error takes the whole tree down with it. Without a boundary
// the app goes blank and stays blank — no message, no way back, nothing to tell
// us it happened. For a budgeting app that is indistinguishable from "my money
// has disappeared", which is the worst thing Tend can make someone feel.
//
// Deliberately plain: no theme hook, no context, no navigation. Everything this
// screen could reach for is a thing that might be the reason we are here.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { reportError } from "../lib/errorReporting";

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportError(error, {
      fatal: true,
      screen: String(info?.componentStack || "").trim().split("\n")[0] || undefined,
    });
  }

  retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={s.screen}>
        <View style={s.card}>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.body}>
            Tend hit a problem on this screen. Your budget is safe — nothing has been
            lost, and nothing has been changed.
          </Text>
          <Text style={s.body}>
            We've been told about it automatically. Try again, and if it keeps
            happening, close Tend and reopen it.
          </Text>
          <TouchableOpacity style={s.btn} onPress={this.retry} activeOpacity={0.85}>
            <Text style={s.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

// Fixed colours rather than theme tokens: the theme provider is one of the
// things that could have thrown. These read correctly on either background.
const s = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: "#0E0F13",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  card: {
    width: "100%", maxWidth: 380, backgroundColor: "#161822",
    borderRadius: 20, borderWidth: 1, borderColor: "#262B3C", padding: 26,
  },
  title: {
    color: "#F1F5F9", fontSize: 21, fontWeight: "800", marginBottom: 12,
  },
  body: {
    color: "#9BA3B4", fontSize: 15, lineHeight: 22, marginBottom: 14,
  },
  btn: {
    marginTop: 6, backgroundColor: "#818CF8", borderRadius: 12,
    paddingVertical: 14, alignItems: "center",
  },
  btnText: { color: "#0E0F13", fontSize: 16, fontWeight: "700" },
});
