# Performance fixtures

`npm run bench` measures the parts of the pipeline that run outside Figma: validation, quality audit, legacy migration and patch parsing. Each fixture runs 30 times after warm-up. Figma-side render time needs live Figma, so it is **NOT TESTED** here.

Measured on 2026-11-12:

Environment: linux 6.18.44-fc-v378, Intel(R) Xeon(R) Processor @ 2.10GHz, Node v22.23.4; 30 runs each

| Fixture | Nodes | Size (KiB) | Median (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| Component kit (validate + audit) | 27 | 5.7 | 0.84 | 3.99 |
| Single screen (validate + audit) | 181 | 26.6 | 3.37 | 4.86 |
| Five screens (validate + audit) | 905 | 132.4 | 11.27 | 13.45 |
| Large import near 2000-node limit | 1996 | 296.8 | 25.51 | 28.54 |
| Legacy model output (migrate + validate) | 181 | 26.5 | 15.79 | 19.58 |
| Edit patch, 50 operations | 50 | 3.3 | 0.04 | 0.08 |

The 2,000-node document is the schema limit (`MAX_NODES`). Even there, validation and audit stay well under 100 ms. That means the time cost of large imports is in Figma's own node creation, not in this pipeline.
