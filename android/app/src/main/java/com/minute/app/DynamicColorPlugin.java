package com.minute.app;

import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DynamicColor")
public class DynamicColorPlugin extends Plugin {

    @PluginMethod
    public void getAccentColor(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+ (API 31+)
            int color = ContextCompat.getColor(getContext(), android.R.color.system_accent1_500);
            String hexColor = String.format("#%06X", (0xFFFFFF & color));
            ret.put("value", hexColor);
        } else {
            // Fallback for older Android versions
            ret.put("value", null);
        }
        call.resolve(ret);
    }
}
