# 🤝 Contributing to CariMurah.ai

We welcome contributions to **CariMurah.ai**! Whether you are fixing minor visual bugs, optimizing multi-modal AI prompt chains, or expanding the B2B logistics model, we appreciate your help in accelerating supply chain transparency in Indonesia.

---

## 📬 Contact & Core Maintainers

If you have questions, feedback, or need direct support, reach out to the core team:

*   **Lead Architect**: Akhmad Khudri
*   **Email**: [khudri@binadarma.ac.id](mailto:khudri@binadarma.ac.id)
*   **Telegram Support**: [@khudriakhmad](https://t.me/khudriakhmad)
*   **Discord Community**: [Join Community Channel](https://discord.com/channels/@khudri_61362)
*   **Support Email**: [support@elpeef.com](mailto:support@elpeef.com)
*   **Official Website**: [https://carimurah.elpeef.com](https://carimurah.elpeef.com)

---

## 🌿 Branching Strategy & Workflow

1.  **Fork the Repository**:
    Fork our main repo at [https://github.com/mrbrightsides/carimurah](https://github.com/mrbrightsides/carimurah).

2.  **Create your Branch**:
    Name your branch descriptively based on your feature or bug fix:
    ```bash
    git checkout -b feature/diskon-gila-simulator
    # or
    git checkout -b bugfix/mcp-error-bounds
    ```

3.  **Adhere to Code Quality Standards**:
    *   **TypeScript Standard**: Never use `any` unless absolutely necessary. Standardize types inside `/src/types.ts`.
    *   **Tailwind Consistency**: Respect the established visual themes (B2C: Emerald Green, B2B: Indigo Purple). Use responsive layout prefixes at all times.
    *   **Unsolicited Features**: Maintain strict alignment with established user intent. Never add unnecessary, cluttered visual cards or telemetry logs.

4.  **Lint and Build Verification**:
    Before creating a pull request, run local verification:
    ```bash
    # Run linter checks
    npm run lint
    
    # Run production compilation sequence
    npm run build
    ```

5.  **Create your Pull Request (PR)**:
    Open a PR to our `main` branch. Provide a clear summary highlighting:
    *   What problem was resolved.
    *   Screenshots demonstrating visual adaptations if UI changes were made.
    *   Any safety considerations for server dependencies.

---

## 📜 Code of Conduct
*   Be respectful and helpful to all developers.
*   Prioritize human-centric Indonesian localization.
*   Keep security keys and configuration files encrypted or out of public git commits (always rely on `.env` and `.gitignore`).
