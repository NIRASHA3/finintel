FROM golang:1.25-alpine AS build

WORKDIR /src/services/api
COPY services/api/go.mod services/api/go.sum ./
RUN go mod download
COPY services/api/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/finintel-api ./cmd/server

FROM alpine:3.21
RUN apk add --no-cache ca-certificates wget && addgroup -S finintel && adduser -S -G finintel finintel
COPY --from=build /out/finintel-api /finintel-api
EXPOSE 8080
USER finintel
ENTRYPOINT ["/finintel-api"]
