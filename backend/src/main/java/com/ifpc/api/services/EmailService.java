package com.ifpc.api.services;

import com.ifpc.api.models.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Slf4j
@Service
public class EmailService {

    @Value("${resend.api-key:}")
    private String apiKey;

    @Value("${resend.from-email:service-informatique@ifpc.eu}")
    private String fromEmail;

    @Value("${resend.admin-email:service-informatique@ifpc.eu}")
    private String adminEmail;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * Envoie un email de notification au service informatique (admin) lors d'une demande de création de compte.
     */
    @Async
    public void sendNewRegistrationNotification(User user) {
        String subject = "[IFPC] Nouvelle demande de création de compte : " 
                + safeString(user.getFirstName()) + " " + safeString(user.getLastName());

        String htmlContent = """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; background-color: #f4f6f8; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
                .header { background-color: #1e293b; color: #ffffff; padding: 20px; text-align: center; }
                .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
                .content { padding: 24px; }
                .info-table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 20px; }
                .info-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
                .info-table td.label { font-weight: bold; width: 35%; color: #475569; background-color: #f8fafc; }
                .footer { background-color: #f8fafc; text-align: center; padding: 16px; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; }
                .badge { display: inline-block; padding: 4px 8px; background-color: #fef3c7; color: #92400e; border-radius: 4px; font-weight: 600; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>IFPC — Demande de création de compte</h1>
                </div>
                <div class="content">
                  <p>Bonjour,</p>
                  <p>Une nouvelle demande de création de compte a été soumise sur la plateforme IFPC et nécessite votre validation.</p>
                  
                  <table class="info-table">
                    <tr>
                      <td class="label">Prénom</td>
                      <td>%s</td>
                    </tr>
                    <tr>
                      <td class="label">Nom</td>
                      <td>%s</td>
                    </tr>
                    <tr>
                      <td class="label">Email</td>
                      <td><a href="mailto:%s">%s</a></td>
                    </tr>
                    <tr>
                      <td class="label">Entreprise</td>
                      <td>%s</td>
                    </tr>
                    <tr>
                      <td class="label">Poste / Rôle</td>
                      <td>%s</td>
                    </tr>
                    <tr>
                      <td class="label">Statut actuel</td>
                      <td><span class="badge">En attente (PENDING)</span></td>
                    </tr>
                  </table>

                  <p>Vous pouvez valider ou refuser cette demande depuis le panneau d'administration de la plateforme.</p>
                </div>
                <div class="footer">
                  Cet email a été envoyé automatiquement par le service informatique IFPC.<br>
                  <a href="mailto:service-informatique@ifpc.eu" style="color: #2563eb;">service-informatique@ifpc.eu</a>
                </div>
              </div>
            </body>
            </html>
            """.formatted(
                escapeHtml(safeString(user.getFirstName())),
                escapeHtml(safeString(user.getLastName())),
                escapeHtml(safeString(user.getEmail())),
                escapeHtml(safeString(user.getEmail())),
                escapeHtml(safeString(user.getCompanyName())),
                escapeHtml(safeString(user.getCompanyRole()))
            );

        sendEmail(adminEmail, subject, htmlContent);
    }

    /**
     * Envoie un email de confirmation à l'utilisateur lorsque son compte est approuvé par un administrateur.
     */
    @Async
    public void sendAccountApprovedNotification(User user) {
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            log.warn("Impossible d'envoyer le mail de confirmation : adresse email de l'utilisateur manquante.");
            return;
        }

        String subject = "[IFPC] Votre compte a été confirmé";

        String htmlContent = """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; background-color: #f4f6f8; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
                .header { background-color: #166534; color: #ffffff; padding: 20px; text-align: center; }
                .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
                .content { padding: 24px; }
                .footer { background-color: #f8fafc; text-align: center; padding: 16px; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; }
                .button { display: inline-block; padding: 12px 24px; background-color: #166534; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 16px; margin-bottom: 16px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>IFPC — Compte Confirmé</h1>
                </div>
                <div class="content">
                  <p>Bonjour %s,</p>
                  <p>Bonne nouvelle ! Votre demande de création de compte sur la plateforme IFPC a été approuvée par le service informatique.</p>
                  <p>Vous pouvez dès à présent vous connecter avec vos identifiants pour accéder aux services de la plateforme.</p>
                  <p style="text-align: center;">
                    <a href="https://ifpc.eu/login" class="button">Se connecter à IFPC</a>
                  </p>
                  <p>Si vous avez des questions ou si vous rencontrez le moindre problème, n'hésitez pas à nous contacter à l'adresse <a href="mailto:service-informatique@ifpc.eu" style="color: #166534;">service-informatique@ifpc.eu</a>.</p>
                  <p>Cordialement,<br><strong>Le Service Informatique IFPC</strong></p>
                </div>
                <div class="footer">
                  IFPC — Institut Français des Produits Cidricoles<br>
                  <a href="mailto:service-informatique@ifpc.eu" style="color: #64748b;">service-informatique@ifpc.eu</a>
                </div>
              </div>
            </body>
            </html>
            """.formatted(
                escapeHtml(safeString(user.getFirstName()))
            );

        sendEmail(user.getEmail(), subject, htmlContent);
    }

    private void sendEmail(String toEmail, String subject, String htmlContent) {
        String effectiveApiKey = (apiKey != null && !apiKey.isBlank()) ? apiKey : System.getenv("RESEND_API_KEY");

        if (effectiveApiKey == null || effectiveApiKey.isBlank()) {
            log.warn("Cle API Resend non configuree (RESEND_API_KEY). L'email n'a pas ete envoye a {}", toEmail);
            return;
        }

        try {
            String fromHeader = "IFPC Service Informatique <" + fromEmail + ">";
            String jsonPayload = toJsonPayload(fromHeader, toEmail, subject, htmlContent);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.resend.com/emails"))
                    .header("Authorization", "Bearer " + effectiveApiKey.trim())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("Email Resend envoye avec succes a {} [Status {}]: {}", toEmail, response.statusCode(), response.body());
            } else {
                log.error("Echec de l'envoi de l'email Resend a {} [Status {}]: {}", toEmail, response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.error("Exception lors de l'envoi de l'email Resend a {}", toEmail, e);
        }
    }

    private String toJsonPayload(String from, String to, String subject, String html) {
        return "{"
                + "\"from\":" + escapeJsonString(from) + ","
                + "\"to\":[" + escapeJsonString(to) + "],"
                + "\"subject\":" + escapeJsonString(subject) + ","
                + "\"html\":" + escapeJsonString(html)
                + "}";
    }

    private String escapeJsonString(String input) {
        if (input == null) return "\"\"";
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < ' ') {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        sb.append("\"");
        return sb.toString();
    }

    private String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;")
                    .replace("'", "&#39;");
    }

    private String safeString(String input) {
        return input != null ? input : "";
    }
}
