# Mensagens in-app experimentais

O APK gerado inclui `InAppMessageProvider`, que inicia um poller no processo do aplicativo. Ele consulta `GET /api/notifications/poll?after=<id>` somente quando o processo está visível, usando `user_id.txt` e `registration_key.txt` como headers `X-User-Id` e `X-Registration-Key`. O painel autentica a chave e confere que ela pertence ao user_id informado. A consulta é feita imediatamente ao iniciar e, depois, a cada 30 segundos enquanto o app permanece visível. As mensagens de texto são apresentadas por Toast; não é um push do Android e não usa FCM para entregar a mensagem.

O script `scripts/generate_apk.py` registra o provider no manifesto e anexa `classes7.dex` antes de assinar a APK. O DEX compilado está versionado junto com o fonte Java. Para regenerá-lo, instale um JDK, obtenha `android.jar` e o `r8.jar`/D8 correspondente, e execute:

```bash
ANDROID_JAR=/caminho/android.jar D8_JAR=/caminho/r8.jar scripts/in_app_messages/build_dex.sh
```

O backend precisa estar atualizado, com a migration `20261125210000_add_in_app_notifications` aplicada e a rota de polling implantada. A APK de fumaça criada durante o desenvolvimento usa uma chave fictícia e serve apenas para validar rebuild/manifesto/assinatura; ela não pode autenticar em um painel real. A confirmação final de entrega exige gerar a APK pelo painel, instalá-la e observar uma mensagem enviada pelo card enquanto o aplicativo está aberto e com conexão.
