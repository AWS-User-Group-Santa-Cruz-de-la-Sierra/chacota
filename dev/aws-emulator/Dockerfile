# AWS Emulator (https://github.com/aws/aws-emulator). AWS doesn't publish an image: this follows
# "Getting started with Docker" in the user guide and installs the official Linux package.
FROM public.ecr.aws/amazonlinux/amazonlinux:2023-minimal
ARG TARGETARCH
RUN ARCH=$([ "$TARGETARCH" = "arm64" ] && echo aarch64 || echo x86_64) \
 && curl -fsSL -o /tmp/aws-emulator.rpm "https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/latest/aws-emulator-${ARCH}.rpm" \
 && rpm -i --nodeps /tmp/aws-emulator.rpm && rm /tmp/aws-emulator.rpm
# Sin descarga versionada (LTS/latest cambia): deja la versión instalada en el log del build.
RUN aws-emulator --version
ENV HOME=/home/emulator EMULATOR_BIND_ADDRESS=0.0.0.0 EMULATOR_TELEMETRY=off
ENTRYPOINT ["aws-emulator"]
