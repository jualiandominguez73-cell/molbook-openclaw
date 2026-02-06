#include <iostream>
#include <memory>
#include <string>
#include <filesystem>
#include <algorithm>
#include <cmath>
#include <regex>

#include <grpcpp/grpcpp.h>
#include "generated/utils.grpc.pb.h"

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::Status;
using utils::UtilsService;
using utils::EnsureDirRequest;
using utils::EnsureDirResponse;
using utils::ClampNumberRequest;
using utils::ClampNumberResponse;
using utils::JidToE164Request;
using utils::JidToE164Response;

// Inline ASM simple counter
extern "C" int asm_increment(int val) {
    int res;
    // Simple x86 assembly to increment
    __asm__ (
        "addl $1, %%eax;"
        : "=a" (res)
        : "a" (val)
    );
    return res;
}

class UtilsServiceImpl final : public UtilsService::Service {
    Status EnsureDir(ServerContext* context, const EnsureDirRequest* request,
                  EnsureDirResponse* reply) override {
        try {
            std::filesystem::create_directories(request->path());
            reply->set_success(true);
        } catch (const std::exception& e) {
            reply->set_success(false);
            reply->set_error(e.what());
        }
        return Status::OK;
    }

    Status ClampNumber(ServerContext* context, const ClampNumberRequest* request,
                       ClampNumberResponse* reply) override {
        // Use ASM just to show off
        int counter = asm_increment(0);
        (void)counter; // Suppress unused warning

        double v = request->value();
        double mn = request->min();
        double mx = request->max();
        reply->set_result(std::max(mn, std::min(mx, v)));
        return Status::OK;
    }

    Status JidToE164(ServerContext* context, const JidToE164Request* request,
                     JidToE164Response* reply) override {
        std::string jid = request->jid();
        // Basic regex implementation for ^(\d+)(?::\d+)?@(s\.whatsapp\.net|hosted)$
        std::regex re("^(\\d+)(?::\\d+)?@(s\\.whatsapp\\.net|hosted)$");
        std::smatch match;
        if (std::regex_search(jid, match, re) && match.size() > 1) {
             reply->set_e164("+" + match.str(1));
        }
        return Status::OK;
    }
};

void RunServer() {
    std::string server_address("0.0.0.0:50051");
    UtilsServiceImpl service;

    ServerBuilder builder;
    builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);
    std::unique_ptr<Server> server(builder.BuildAndStart());
    std::cout << "Server listening on " << server_address << std::endl;
    server->Wait();
}

int main(int argc, char** argv) {
    RunServer();
    return 0;
}
