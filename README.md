# ysyx-sdb-tui README

The ysyx-sdb-tui is a extension for NEMU or NPC SDB debugging tool. You can make the SDB support TUI mode in Visual Studio Code.

It can highlight the source code and disassembly code.

![ysyx-sdb-tui](image/vscode-sdb-tui.png)

## Requirements

You should install the `socket.io` package in your project.

```
npm install socket.io
npm install @types/socket.io
```

You need to add interface to NEMU or NPC. The source code and guide is in another repository.

- 

## Extension Settings

You can set the socket server port in the settings.json file, default is 49159.

```json
{
    "ysyx-sdb-tui.port": 49159
}
```

## Known Issues

If you have any problems, please let me know.

## Release Notes

The initial release of ysyx-sdb-tui.

### 0.0.1

The first release of ysyx-sdb-tui. Maybe it's not perfect, but it's a start.

---

## Following extension guidelines
1. Install this extension from the marketplace. Search for `ysyx-sdb-tui`.
2. Type `Ctrl+Shift+P` to open the command palette.
3. Type `Enable ysyx-sdb-tui` and press `Enter`.
4. Run you NEMU or NPC program in the VSCode terminal in SDB debug mode.

## References

* [One Student One Chip Program](https://ysyx.oscc.cc/)
* [VS Code API](https://code.visualstudio.com/api/references/vscode-api)
