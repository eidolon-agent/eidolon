# Contributing

Thanks for considering contributing to SimCity! This is a portfolio project, so contributions are welcome but expect review to be selective.

## How to Contribute

1. **Fork the repository** (if external) or create a feature branch.
2. **Make changes** following the existing code style.
3. **Run tests** — `yarn workspace @simcity/contracts test` must pass.
4. **Compile** — `yarn workspace @simcity/contracts build` should succeed.
5. **Submit a Pull Request** with a clear description.

## Code Style

- **Solidity:** Use Foundry's `forge fmt` to format. Follow OpenZeppelin conventions.
- **TypeScript:** Use Prettier (default Next.js style). 2‑space indent.
- **Commits:** Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## Testing

- Add **unit tests** for any new contract function.
- Add **fuzz tests** for complex logic where applicable.
- For frontend changes, include screenshot or description of UI impact.

## Security

- Do not introduce new external calls without review.
- Be extra careful with state changes and reentrancy.
- If adding a new contract, include NatSpec comments for all public/external functions.

## Questions?

Open an issue first to discuss proposed changes. For quick questions, reach out on the repository's Discussions tab.

---

Thank you for helping make SimCity better! 🎮
