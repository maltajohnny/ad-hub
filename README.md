# AD-HUB

## Resolução de problemas

### Separador Rede (DevTools): `completion_list.html`, `utils.js`, `extensionState.js`, …

Esses pedidos **não fazem parte** do build da aplicação. O ficheiro `completion_list.html` e scripts como `utils.js` / `extensionState.js` / `heuristicsRedefinitions.js` são injetados por **extensões do browser** (gestor de palavras-passe, autocomplete, etc.). Falhas `net::…` nesses recursos são comuns e **não indicam erro no código** do AD-HUB.

Para validar o site: filtre no Network pelo origin da app (ex. `index-*.js` em `ad-hub.digital`) ou teste numa **janela anónima sem extensões`.

Se no Console aparecer `chrome-extension://pejdijmoenmkgeppbflobdennhabjlaj/...` com `ERR_FILE_NOT_FOUND`, isso é o **Gestor de palavras-passe integrado do Google Chrome** a falhar a carregar ficheiros **dentro do próprio browser** — não é pedido ao servidor AD-HUB e **não se corrige no repositório**. Atualize o Chrome, experimente outro perfil ou ignore esses avisos se o login funcionar.
