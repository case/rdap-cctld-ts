# rdap-cctld-ts

## Overview

Each night, this project fetches three different [IANA](https://www.iana.org/) data files (related to top-level domains), and stores copies of them in 1) this git repo, and 2) ValTown blob storage. They are _small data_, so it's ok.

The idea is to be able to see at a glance, things like:

- How many delegated TLDs are there?
- Of these, how many are country-code TLDs vs. generics?
- How many have RDAP servers? (all the generics are supposed to have them, but for the ccTLDs it's entirely optional)
- Are there ccTLD RDAP servers that _aren't_ in the IANA bootstrap file?

And later on, we'll add some lightweight monitoring to stay ahead of [issues like this](https://github.com/meeb/whoisit/pull/54).

## Val Town

I'm primarily tinkering with this project, to learn how [Val Town](https://val.town) works.

- [cctld-rdap-web](https://www.val.town/x/waddupcase/cctld-rdap-web) - The web frontend
- [cctld-rdap-data-fetcher](https://www.val.town/x/waddupcase/cctld-rdap-data-fetcher) - The scheduled job that fetches new data each night

## FAQ

- [What is RDAP](https://en.wikipedia.org/wiki/Registration_Data_Access_Protocol)?
- [What are ccTLDs](https://en.wikipedia.org/wiki/Country_code_top-level_domain)?
- [What are gTLDs](https://en.wikipedia.org/wiki/Generic_top-level_domain?
- Which files are we keeping an eye on here?
  - The IANA [RDAP "bootstrap" file](https://data.iana.org/rdap/dns.json)
  - The IANAN ["all TLDs" txt file](https://data.iana.org/TLD/tlds-alpha-by-domain.txt)
  - The [IANA Root Zone DB html file](https://www.iana.org/domains/root/db), which alas doesn't appear to be available in a friendlier format

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

- [ ] Add `data/tlds.json` to source control (it's currently in `gitignore`)
- [ ] Figure out how to run `server.ts` on val.town
- [ ] An HTTP + web interface
- [ ] Lightweight "monitoring" checks for the ccTLD RDAP servers, which don't have the same SLAs as the generics

## Done

2025-11-14:
- [x] TLDs txt file - ignore the first line (timestamp) before saving it
- [x] Nightly data updates - GH Actions
- [x] Tests running in GH Actions
- [x] Deno dep updates in GH Actions
- [x] Only update `data/metadata.json` when there are downloaded file updates

2025-11-13:
- [x] A unified, generated `tlds.json` file that includes all the data we need, for an eventual web interface

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
