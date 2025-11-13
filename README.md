# rdap-cctld-ts

## Overview

Each night, this project fetches three different [IANA](https://www.iana.org/) data files (related to top-level domains), and stores copies of them in source control. They are _small data_, so it's ok.

The idea is to be able to see at a glance, things like:

- How many delegated TLDs are there?
- Of these, how many are country-code TLDs vs. generics?
- How many have RDAP servers? (all the generics are supposed to have them, but for the ccTLDs it's entirely optional)
- Are there ccTLD RDAP servers that _aren't_ in the IANA bootstrap file?

And later on, we'll add some lightweight monitoring to stay ahead of [issues like this](https://github.com/meeb/whoisit/pull/54).

## FAQ

- What's RDAP? See: https://en.wikipedia.org/wiki/Registration_Data_Access_Protocol
- What are ccTLDs? See: https://en.wikipedia.org/wiki/Country_code_top-level_domain
- What are gTLDs? See: https://en.wikipedia.org/wiki/Generic_top-level_domain
- Which files are we keeping an eye on here?
  - The RDAP "bootstrap" file: https://data.iana.org/rdap/dns.json
  - The "all TLDs" txt file: https://data.iana.org/TLD/tlds-alpha-by-domain.txt
  - The Root Zone DB html file, which alas doesn't appear to be available in a friendlier format: https://www.iana.org/domains/root/db

## Tests

In the fixture files, the IDN ccTLDs are:

- `xn--kpry57d` is `台灣` (`tw`) - [via](https://www.iana.org/domains/root/db/xn--kpry57d.html)
- `xn--2scrj9c` is `ಭಾರತ` (`in`) - [via](https://www.iana.org/domains/root/db/xn--2scrj9c.html)
- `xn--4dbrk0ce` is `ישראל` (`il`) - [via](https://www.iana.org/domains/root/db/xn--4dbrk0ce.html)
- `xn--flw351e` is `谷歌` ("Google" in Chinese) - [via](https://www.iana.org/domains/root/db/xn--flw351e.html)
- `xn--wgbh1c` is `.مصر` (`eg`) - [via](https://www.iana.org/domains/root/db/xn--wgbh1c.html)

## IANA data files

We're able to check for changes prior to downloading the files:

- The RDAP bootstrap file has both `ETag` and `Last-Modified` headers
- The TLD list file has both `ETag` and `Last-Modified` headers
- The root zone db (html) has a `Cache-Control` header

## Todo

- [ ] Figure out how to run `server.ts` on val.town
- [ ] Nightly data updates - GH Actions
- [ ] An HTTP + web interface
- [ ] A unified, generated `tlds.json` file that includes all the data we need, for an eventual web interface
- [ ] Lightweight "monitoring" checks for the ccTLD RDAP servers, which don't have the same SLAs as the generics

## Done

2025-11-12:
- [x] Refactor to be "an API" with simple CLI & web clients
- [x] Use Cliffy for terminal tables output
- [x] Update the CLI analysis output a bit
- [x] Added the unlisted ccTLD RDAP servers

2025-11-11:
- [x] Project creation
- [x] Fixtures for all three data files
- [x] Download & last-updated checks for all three files
- [x] Downloaded file validation, parsing, and tests for all three files
- [x] CLI, for understanding and munging the data, and prototyping future interfaces
- [x] Reconciled the various TLD metadata counts - cctlds, gtlds, IDNs, sponsored, infra, etc. - across all three files
