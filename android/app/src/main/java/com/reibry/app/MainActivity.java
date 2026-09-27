package com.reibry.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle state) {
        registerPlugin(ReibryCapturePlugin.class);
        super.onCreate(state);
        bridge.getWebView().setWebViewClient(new com.getcapacitor.BridgeWebViewClient(bridge) {
            @Override public boolean shouldOverrideUrlLoading(android.webkit.WebView view, android.webkit.WebResourceRequest request) {
                if (!request.isForMainFrame() || CaptureContract.trusted(request.getUrl().toString())) return super.shouldOverrideUrlLoading(view, request);
                if ("https".equals(request.getUrl().getScheme()) || "http".equals(request.getUrl().getScheme())) {
                    try { startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, request.getUrl())); } catch (Exception ignored) {}
                }
                return true;
            }
        });
    }
    @Override public void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        if (bridge != null && CaptureContract.trusted(bridge.getWebView().getUrl())) bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('reibry-native-launch'))", null);
    }
}
