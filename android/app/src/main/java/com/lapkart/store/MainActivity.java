package com.lapkart.store;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ServiceWorkerController;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final String KEYBOARD_CHROME_GUARD_JS =
        "(function(){" +
        "if(window.__lapkartKeyboardChromeGuard)return;" +
        "window.__lapkartKeyboardChromeGuard=true;" +
        "var style=document.createElement('style');" +
        "style.id='lapkart-keyboard-chrome-guard';" +
        "style.textContent=\"html[data-lapkart-editing='true'] .mobile-tabbar,html[data-lapkart-keyboard='open'] .mobile-tabbar,html[data-lapkart-editing='true'] .sticky-atc,html[data-lapkart-keyboard='open'] .sticky-atc{display:none!important;opacity:0!important;pointer-events:none!important;}\";" +
        "(document.head||document.documentElement).appendChild(style);" +
        "function editable(el){return !!el&&((el.tagName==='INPUT')||(el.tagName==='TEXTAREA')||(el.tagName==='SELECT')||el.isContentEditable||el.getAttribute('role')==='textbox');}" +
        "function setEditing(on){var root=document.documentElement;if(on){root.dataset.lapkartEditing='true';root.dataset.lapkartKeyboard='open';}else{delete root.dataset.lapkartEditing;delete root.dataset.lapkartKeyboard;}}" +
        "document.addEventListener('focusin',function(event){if(editable(event.target))setEditing(true);},true);" +
        "document.addEventListener('focusout',function(){setTimeout(function(){setEditing(editable(document.activeElement));},200);},true);" +
        "window.addEventListener('resize',function(){if(!editable(document.activeElement))setEditing(false);},{passive:true});" +
        "})();";

    private SwipeRefreshLayout swipeRefreshLayout;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
        super.onCreate(savedInstanceState);
        configureWebViewPerformance();
    }

    private void configureWebViewPerformance() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        WebSettings settings = webView.getSettings();
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setBlockNetworkImage(false);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setVerticalScrollBarEnabled(false);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            settings.setOffscreenPreRaster(true);
        }

        configurePullToRefresh(webView);
        installKeyboardChromeGuard(webView);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            ServiceWorkerController
                .getInstance()
                .getServiceWorkerWebSettings()
                .setCacheMode(WebSettings.LOAD_DEFAULT);
        }
    }

    private void configurePullToRefresh(WebView webView) {
        if (webView.getParent() instanceof SwipeRefreshLayout) return;
        if (!(webView.getParent() instanceof ViewGroup parent)) return;

        int index = parent.indexOfChild(webView);
        ViewGroup.LayoutParams originalParams = webView.getLayoutParams();
        parent.removeView(webView);

        swipeRefreshLayout = new SwipeRefreshLayout(this);
        swipeRefreshLayout.setLayoutParams(originalParams);
        swipeRefreshLayout.setColorSchemeColors(0xFFFA5D19);
        swipeRefreshLayout.setProgressBackgroundColorSchemeColor(0xFFFFFFFF);
        swipeRefreshLayout.setDistanceToTriggerSync(dp(92));
        swipeRefreshLayout.setProgressViewOffset(false, dp(20), dp(72));
        swipeRefreshLayout.setOnChildScrollUpCallback((layout, child) -> webView.getScrollY() > 0);
        swipeRefreshLayout.setOnRefreshListener(() -> {
            if (getBridge() == null) {
                stopPullRefresh();
                return;
            }
            String url = webView.getUrl();
            if (url != null && url.contains("offline.html")) {
                webView.loadUrl(getBridge().getAppUrl());
            } else {
                webView.reload();
            }
        });

        swipeRefreshLayout.addView(
            webView,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        parent.addView(swipeRefreshLayout, index);

        getBridge().addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageLoaded(WebView loadedWebView) {
                    stopPullRefresh();
                }

                @Override
                public void onReceivedError(WebView loadedWebView) {
                    stopPullRefresh();
                }

                @Override
                public void onReceivedHttpError(WebView loadedWebView) {
                    stopPullRefresh();
                }
            }
        );
    }

    private void installKeyboardChromeGuard(WebView webView) {
        webView.evaluateJavascript(KEYBOARD_CHROME_GUARD_JS, null);
        getBridge().addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageLoaded(WebView loadedWebView) {
                    loadedWebView.evaluateJavascript(KEYBOARD_CHROME_GUARD_JS, null);
                }
            }
        );
    }

    private void stopPullRefresh() {
        if (swipeRefreshLayout != null && swipeRefreshLayout.isRefreshing()) {
            swipeRefreshLayout.setRefreshing(false);
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
