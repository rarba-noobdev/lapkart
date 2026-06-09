package com.lapkart.store;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class MainActivity extends BridgeActivity {

    private static final int UPI_INTENT_REQUEST_CODE = 1001;
    private static final Set<String> UPI_SCHEMES = new HashSet<>(Arrays.asList(
        "upi", "tez", "phonepe", "paytmmp", "credpay", "bhim",
        "amazonpay", "mobikwik", "gpay", "whatsapp",
        "in.fampay.app", "navi", "kiwi", "payzapp", "jupiter",
        "icici", "sbiyono", "myjio", "slice-upi", "bobupi",
        "shriramone", "indusmobile", "kotakbank"
    ));

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();

        Bridge bridge = this.getBridge();
        if (bridge == null) return;

        WebView webView = bridge.getWebView();
        if (webView == null) return;

        // Subclass Capacitor's BridgeWebViewClient so the local-server asset
        // interception (shouldInterceptRequest serving https://localhost from the
        // bundled www/) stays intact. A plain WebViewClient would replace it and
        // send https://localhost to the network -> net::ERR_CONNECTION_REFUSED.
        webView.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();

                if (scheme != null && UPI_SCHEMES.contains(scheme.toLowerCase())) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivityForResult(intent, UPI_INTENT_REQUEST_CODE);
                    } catch (Exception e) {
                        // No UPI app installed for this scheme
                    }
                    return true;
                }

                if (scheme != null && !scheme.equals("http") && !scheme.equals("https")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception e) {
                        // No handler for this scheme
                    }
                    return true;
                }

                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == UPI_INTENT_REQUEST_CODE) {
            Bridge bridge = this.getBridge();
            if (bridge == null) return;

            WebView webView = bridge.getWebView();
            if (webView == null) return;

            // Notify Razorpay checkout JS that UPI intent flow completed
            String callbackJs = "javascript:void(document.dispatchEvent(new CustomEvent('upi-intent-result', {detail: {resultCode: " + resultCode + "}})))";
            webView.post(() -> webView.evaluateJavascript(
                "document.dispatchEvent(new CustomEvent('upi-intent-result', {detail: {resultCode: " + resultCode + "}}))",
                null
            ));
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        Uri data = intent.getData();
        if (data != null) {
            Bridge bridge = this.getBridge();
            if (bridge != null) {
                WebView webView = bridge.getWebView();
                if (webView != null) {
                    webView.post(() -> webView.loadUrl(data.toString()));
                }
            }
        }
    }
}
