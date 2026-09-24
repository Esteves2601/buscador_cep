package com.cep.buscador;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Locale;

/** Buscador de CEP — consulta o ViaCEP (programa de terceiros) e mostra o endereco. */
public class MainActivity extends Activity {

    // Cores do tema (bege de fundo, verde nos botoes/destaques)
    private static final int BEGE = 0xFFF3EDE0;
    private static final int BEGE_ESC = 0xFFE7DCC3;
    private static final int VERDE = 0xFF2F7D33;
    private static final int VERDE_ESC = 0xFF1D5220;
    private static final int BRANCO = 0xFFFFFDF6;
    private static final int CINZA = 0xFF6B5D4D;
    private static final int PRETO = 0xFF000000;
    private static final int VERMELHO = 0xFFC0392B;
    private static final int LINHA = 0xFFF1E9D6;

    private EditText cepInput, ufInput, cidadeInput, ruaInput;
    private TextView status1, status2;
    private TextView[] valores = new TextView[7];
    private LinearLayout tabCep, tabEnd, resultadosBox;
    private Button tabBtn1, tabBtn2, btnMapa;
    private String ultimoEndereco = "";

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v,
                getResources().getDisplayMetrics());
    }

    private GradientDrawable fundo(int cor, int raio) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(cor);
        g.setCornerRadius(dp(raio));
        return g;
    }

    private GradientDrawable contorno(int corFundo, int corBorda) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(corFundo);
        g.setCornerRadius(dp(8));
        g.setStroke(dp(2), corBorda);
        return g;
    }

    private TextView texto(String s, int tamanho, int cor, boolean negrito) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, tamanho);
        t.setTextColor(cor);
        if (negrito) t.setTypeface(null, Typeface.BOLD);
        return t;
    }

    private EditText campo(String dica, int inputType, int max) {
        EditText e = new EditText(this);
        e.setHint(dica);
        e.setInputType(inputType);
        e.setFilters(new InputFilter[]{new InputFilter.LengthFilter(max)});
        e.setBackground(contorno(0xFFFFFFFF, 0xFFD8CBB2));
        e.setPadding(dp(12), dp(12), dp(12), dp(12));
        e.setTextColor(PRETO);
        e.setHintTextColor(CINZA);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        p.bottomMargin = dp(8);
        e.setLayoutParams(p);
        return e;
    }

    private Button botao(String s, boolean primario) {
        Button b = new Button(this, null, 0, android.R.style.Widget_Material_Button);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        if (primario) {
            b.setBackground(fundo(VERDE, 8));
            b.setTextColor(0xFFFFFFFF);
        } else {
            b.setBackground(contorno(BRANCO, VERDE));
            b.setTextColor(VERDE);
        }
        b.setTypeface(null, Typeface.BOLD);
        b.setPadding(dp(8), dp(12), dp(8), dp(12));
        return b;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ScrollView scroll = new ScrollView(this);
        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setBackgroundColor(BEGE);
        raiz.setPadding(dp(16), dp(16), dp(16), dp(16));
        scroll.addView(raiz);
        setContentView(scroll);

        // Cabecalho verde
        LinearLayout cab = new LinearLayout(this);
        cab.setBackground(fundo(VERDE, 0));
        cab.setPadding(dp(12), dp(14), dp(12), dp(14));
        cab.setGravity(Gravity.CENTER);
        TextView titulo = texto("Buscador de CEP", 22, 0xFFFFFFFF, true);
        titulo.setGravity(Gravity.CENTER);
        cab.addView(titulo);
        raiz.addView(cab);

        TextView sub = texto("Consulta de enderecos via ViaCEP", 13, CINZA, false);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, dp(4), 0, dp(8));
        raiz.addView(sub);

        // Abas
        LinearLayout abas = new LinearLayout(this);
        abas.setOrientation(LinearLayout.HORIZONTAL);
        tabBtn1 = botao("CEP -> Endereco", true);
        tabBtn2 = botao("Endereco -> CEP", false);
        LinearLayout.LayoutParams peso = new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        peso.rightMargin = dp(8);
        tabBtn1.setLayoutParams(peso);
        tabBtn2.setLayoutParams(new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        tabBtn1.setOnClickListener(v -> mostrarAba(true));
        tabBtn2.setOnClickListener(v -> mostrarAba(false));
        abas.addView(tabBtn1);
        abas.addView(tabBtn2);
        raiz.addView(abas);

        tabCep = new LinearLayout(this);
        tabCep.setOrientation(LinearLayout.VERTICAL);
        tabCep.setPadding(0, dp(12), 0, 0);
        raiz.addView(tabCep);

        tabEnd = new LinearLayout(this);
        tabEnd.setOrientation(LinearLayout.VERTICAL);
        tabEnd.setPadding(0, dp(12), 0, 0);
        tabEnd.setVisibility(View.GONE);
        raiz.addView(tabEnd);

        montarAbaCep();
        montarAbaEndereco();
    }

    private void mostrarAba(boolean cep) {
        tabCep.setVisibility(cep ? View.VISIBLE : View.GONE);
        tabEnd.setVisibility(cep ? View.GONE : View.VISIBLE);
        tabBtn1.setBackground(cep ? fundo(VERDE, 8) : contorno(BRANCO, VERDE));
        tabBtn1.setTextColor(cep ? 0xFFFFFFFF : VERDE);
        tabBtn2.setBackground(cep ? contorno(BRANCO, VERDE) : fundo(VERDE, 8));
        tabBtn2.setTextColor(cep ? VERDE : 0xFFFFFFFF);
    }

    // ---------------- Aba 1: CEP -> Endereco ----------------
    private void montarAbaCep() {
        tabCep.addView(texto("CEP:", 14, PRETO, true));
        cepInput = campo("Ex: 01310-100", InputType.TYPE_CLASS_NUMBER, 9);
        tabCep.addView(cepInput);

        LinearLayout linha = new LinearLayout(this);
        linha.setOrientation(LinearLayout.HORIZONTAL);
        Button buscar = botao("Buscar", true);
        Button limpar = botao("Limpar", false);
        LinearLayout.LayoutParams peso = new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        peso.rightMargin = dp(8);
        buscar.setLayoutParams(peso);
        limpar.setLayoutParams(new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        buscar.setOnClickListener(v -> buscarCep());
        limpar.setOnClickListener(v -> limparCep());
        linha.addView(buscar);
        linha.addView(limpar);
        tabCep.addView(linha);

        status1 = texto("Digite um CEP e toque em Buscar.", 13, CINZA, false);
        status1.setPadding(0, dp(8), 0, dp(8));
        tabCep.addView(status1);

        LinearLayout cartao = new LinearLayout(this);
        cartao.setOrientation(LinearLayout.VERTICAL);
        cartao.setBackground(fundo(BRANCO, 10));
        cartao.setPadding(dp(14), dp(10), dp(14), dp(10));
        String[] rotulos = {"Rua", "Bairro", "Cidade", "UF", "DDD", "IBGE", "CEP"};
        for (int i = 0; i < rotulos.length; i++) {
            LinearLayout l = new LinearLayout(this);
            l.setOrientation(LinearLayout.HORIZONTAL);
            l.setPadding(0, dp(3), 0, dp(3));
            TextView rot = texto(rotulos[i] + ":", 14, PRETO, true);
            rot.setLayoutParams(new LinearLayout.LayoutParams(dp(80),
                    LinearLayout.LayoutParams.WRAP_CONTENT));
            valores[i] = texto("-", 14, PRETO, false);
            if (i % 2 == 1) valores[i].setBackgroundColor(LINHA);
            valores[i].setLayoutParams(new LinearLayout.LayoutParams(0,
                    LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
            l.addView(rot);
            l.addView(valores[i]);
            cartao.addView(l);
        }
        tabCep.addView(cartao);

        btnMapa = botao("Ver no mapa", false);
        btnMapa.setEnabled(false);
        btnMapa.setAlpha(0.5f);
        LinearLayout.LayoutParams pm = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        pm.topMargin = dp(10);
        btnMapa.setLayoutParams(pm);
        btnMapa.setOnClickListener(v -> {
            if (!ultimoEndereco.isEmpty()) {
                try {
                    String url = "https://www.google.com/maps/search/?api=1&query="
                            + URLEncoder.encode(ultimoEndereco, "UTF-8");
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) { }
            }
        });
        tabCep.addView(btnMapa);
    }

    private void buscarCep() {
        String digitos = cepInput.getText().toString().replaceAll("\\D", "");
        if (digitos.length() != 8) {
            status("status1", "Digite um CEP com 8 digitos.", VERMELHO);
            return;
        }
        status("status1", "Consultando o ViaCEP...", CINZA);
        new Thread(() -> {
            try {
                // Joga o CEP no ViaCEP (programa de terceiros) e recebe o JSON de volta
                JSONObject o = getJson("https://viacep.com.br/ws/" + digitos + "/json/");
                if (o.has("erro")) throw new Exception("CEP nao encontrado.");
                String rua = o.optString("logradouro", "-");
                String bairro = o.optString("bairro", "-");
                String cidade = o.optString("localidade", "-");
                String uf = o.optString("uf", "-");
                String[] vals = {rua, bairro, cidade, uf,
                        o.optString("ddd", "-"), o.optString("ibge", "-"),
                        formatarCep(o.optString("cep", digitos))};
                ultimoEndereco = String.join(", ",
                        rua.equals("-") ? "" : rua,
                        bairro.equals("-") ? "" : bairro,
                        cidade.equals("-") ? "" : cidade,
                        uf.equals("-") ? "" : uf).replaceAll("(, )+", ", ").replaceAll("^, |, $", "");
                runOnUiThread(() -> {
                    for (int i = 0; i < vals.length; i++) valores[i].setText(vals[i]);
                    btnMapa.setEnabled(true);
                    btnMapa.setAlpha(1f);
                    status("status1", "Endereco retornado pelo ViaCEP.", VERDE);
                });
            } catch (Exception e) {
                runOnUiThread(() -> status("status1",
                        "Erro: " + e.getMessage() + " (sem internet?)", VERMELHO));
            }
        }).start();
    }

    private void limparCep() {
        cepInput.setText("");
        for (TextView t : valores) t.setText("-");
        btnMapa.setEnabled(false);
        btnMapa.setAlpha(0.5f);
        ultimoEndereco = "";
        status("status1", "Digite um CEP e toque em Buscar.", CINZA);
    }

    // ---------------- Aba 2: Endereco -> CEP ----------------
    private void montarAbaEndereco() {
        tabEnd.addView(texto("UF (2 letras):", 14, PRETO, true));
        ufInput = campo("Ex: SP", InputType.TYPE_CLASS_TEXT, 2);
        tabEnd.addView(ufInput);
        tabEnd.addView(texto("Cidade:", 14, PRETO, true));
        cidadeInput = campo("Ex: Sao Paulo", InputType.TYPE_CLASS_TEXT, 60);
        tabEnd.addView(cidadeInput);
        tabEnd.addView(texto("Rua (min. 3 letras):", 14, PRETO, true));
        ruaInput = campo("Ex: Avenida Paulista", InputType.TYPE_CLASS_TEXT, 60);
        tabEnd.addView(ruaInput);

        Button buscar = botao("Buscar CEP", true);
        buscar.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        buscar.setOnClickListener(v -> buscarEndereco());
        tabEnd.addView(buscar);

        status2 = texto("Digite UF, cidade e rua.", 13, CINZA, false);
        status2.setPadding(0, dp(8), 0, dp(8));
        tabEnd.addView(status2);

        resultadosBox = new LinearLayout(this);
        resultadosBox.setOrientation(LinearLayout.VERTICAL);
        tabEnd.addView(resultadosBox);
    }

    private void buscarEndereco() {
        String uf = ufInput.getText().toString().trim().toUpperCase(Locale.ROOT);
        String cidade = cidadeInput.getText().toString().trim();
        String rua = ruaInput.getText().toString().trim();
        if (uf.length() != 2 || cidade.isEmpty() || rua.length() < 3) {
            status("status2", "Informe UF, cidade e rua (min. 3 letras).", VERMELHO);
            return;
        }
        status("status2", "Consultando o ViaCEP...", CINZA);
        resultadosBox.removeAllViews();
        new Thread(() -> {
            try {
                String url = "https://viacep.com.br/ws/" + URLEncoder.encode(uf, "UTF-8")
                        + "/" + URLEncoder.encode(cidade, "UTF-8")
                        + "/" + URLEncoder.encode(rua, "UTF-8") + "/json/";
                String corpo = baixar(url).trim();
                if (corpo.equals("[]")) throw new Exception("Nenhum endereco encontrado.");
                JSONArray arr = new JSONArray(corpo);
                int n = Math.min(arr.length(), 15);
                runOnUiThread(() -> {
                    for (int i = 0; i < n; i++) {
                        try {
                            JSONObject o = arr.getJSONObject(i);
                            TextView t = texto(formatarCep(o.optString("cep", "")) + " - "
                                    + o.optString("logradouro", "") + ", "
                                    + o.optString("bairro", ""), 14, PRETO, false);
                            t.setBackground(fundo(i % 2 == 1 ? LINHA : BRANCO, 5));
                            t.setPadding(dp(8), dp(8), dp(8), dp(8));
                            resultadosBox.addView(t);
                        } catch (Exception ignored) { }
                    }
                    status("status2", n + " resultado(s) retornado(s) pelo ViaCEP.", VERDE);
                });
            } catch (Exception e) {
                runOnUiThread(() -> status("status2",
                        "Erro: " + e.getMessage() + " (sem internet?)", VERMELHO));
            }
        }).start();
    }

    // ---------------- Conexao com o terceiro (ViaCEP) ----------------
    private JSONObject getJson(String url) throws Exception {
        return new JSONObject(baixar(url));
    }

    private String baixar(String urlStr) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(urlStr).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setRequestProperty("User-Agent", "BuscadorCEP-Trabalho-Faculdade/1.0");
        BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String linha;
        while ((linha = r.readLine()) != null) sb.append(linha);
        r.close();
        return sb.toString();
    }

    private String formatarCep(String d) {
        d = d.replaceAll("\\D", "");
        return d.length() == 8 ? d.substring(0, 5) + "-" + d.substring(5) : d;
    }

    private void status(String qual, String msg, int cor) {
        TextView t = qual.equals("status1") ? status1 : status2;
        t.setText(msg);
        t.setTextColor(cor);
        if (cor == VERDE || cor == VERMELHO) t.setTypeface(null, Typeface.BOLD);
        else t.setTypeface(null, Typeface.NORMAL);
    }
}
