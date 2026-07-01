package com.lapkart.store;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewOutcomeReceiver;
import androidx.webkit.WebViewStartUpConfig;
import androidx.webkit.WebViewStartUpResult;
import androidx.webkit.WebViewStartupException;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LapKartApplication extends Application {
    private ExecutorService webViewStartupExecutor;

    @Override
    public void onCreate() {
        super.onCreate();

        webViewStartupExecutor = Executors.newSingleThreadExecutor();
        WebViewStartUpConfig config = new WebViewStartUpConfig.Builder(webViewStartupExecutor)
            .build();

        WebViewCompat.startUpWebView(
            getApplicationContext(),
            config,
            new WebViewOutcomeReceiver<WebViewStartUpResult, WebViewStartupException>() {
                @Override
                public void onResult(@NonNull WebViewStartUpResult result) {
                    stopStartupExecutor();
                }

                @Override
                public void onError(@NonNull WebViewStartupException error) {
                    stopStartupExecutor();
                }
            }
        );
    }

    private void stopStartupExecutor() {
        if (webViewStartupExecutor != null) {
            webViewStartupExecutor.shutdown();
            webViewStartupExecutor = null;
        }
    }
}
