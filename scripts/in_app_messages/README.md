# Mensagens in-app experimentais

O APK gerado inclui `InAppMessageProvider`, que inicia um poller no processo do aplicativo. Ele consulta `GET /api/notifications/poll?after=<id>` somente quando há uma Activity visível, usando `user_id.txt` e `registration_key.txt` como headers `X-User-Id` e `X-Registration-Key`. O painel autentica a chave e confere que ela pertence ao user_id informado. A consulta acontece a cada cinco segundos enquanto o app está aberto. As mensagens aparecem uma por vez em um card próprio no topo da tela, com fundo roxo-escuro opaco `#060016`, texto claro, imagem opcional, título, mensagem e botão X para fechar; não é o diálogo nativo de atualização. O cursor é salvo depois que o card é dispensado, evitando repetir a mesma mensagem. Na primeira abertura desta versão, o cliente inicializa o cursor no ID mais recente para não reapresentar o histórico antigo. Não é um push do Android e não usa FCM para entregar a mensagem.

O script `scripts/generate_apk.py` registra o provider no manifesto e anexa `classes7.dex` antes de assinar a APK. O DEX compilado está versionado junto com o fonte Java. Para regenerá-lo, instale um JDK, obtenha `android.jar` e o `r8.jar`/D8 correspondente, e execute:

```bash
ANDROID_JAR=/caminho/android.jar D8_JAR=/caminho/r8.jar scripts/in_app_messages/build_dex.sh
```

O backend precisa estar atualizado, com a migration `20261125210000_add_in_app_notifications` aplicada e a rota de polling implantada. A APK de fumaça criada durante o desenvolvimento usa uma chave fictícia e serve apenas para validar rebuild/manifesto/assinatura; ela não pode autenticar em um painel real. A confirmação final de entrega exige gerar a APK pelo painel, instalá-la e observar uma mensagem enviada pelo card enquanto o aplicativo está aberto e com conexão.
