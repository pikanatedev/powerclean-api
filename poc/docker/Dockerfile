FROM ubuntu:22.04

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libreoffice-core \
      libreoffice-calc \
      libreoffice-writer \
      fonts-thai-tlwg \
      fonts-noto-cjk \
      fonts-noto-color-emoji \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /work

# Convert any input file in /work to PDF and write to /work.
# Example: docker run --rm -v /host/dir:/work cms-libreoffice:latest input.xlsx
ENTRYPOINT ["soffice", "--headless", "--convert-to", "pdf", "--outdir", "/work"]
