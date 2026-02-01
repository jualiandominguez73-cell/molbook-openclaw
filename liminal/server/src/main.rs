use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};
use actix_files::NamedFile;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// Decision Spinner State
#[derive(Serialize, Clone)]
struct SpinnerState {
    mode: String,
    options: Vec<String>,
    spinning: bool,
    result: Option<String>,
}

// API Response wrapper
#[derive(Serialize)]
struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

// Static files path
fn static_path() -> PathBuf {
    PathBuf::from("/home/liam/liminal/server/static")
}

// Main page - serves the creative showcase
#[get("/")]
async fn index() -> impl Responder {
    NamedFile::open(static_path().join("index.html"))
}

// Static assets
#[get("/static/{filename:.*}")]
async fn static_files(filename: web::Path<String>) -> impl Responder {
    let path = static_path().join(filename.as_str());
    NamedFile::open(path)
}

// API: Get project info
#[get("/api/project/{name}")]
async fn get_project(name: web::Path<String>) -> impl Responder {
    let project_path = PathBuf::from("/home/liam/liminal/projects").join(name.as_str());
    
    if !project_path.exists() {
        return HttpResponse::NotFound().json(ApiResponse::<serde_json::Value> {
            success: false,
            data: None,
            error: Some("Project not found".to_string()),
        });
    }
    
    // Read README if exists
    let readme_path = project_path.join("README.md");
    let readme = if readme_path.exists() {
        std::fs::read_to_string(readme_path).ok()
    } else {
        None
    };
    
    // List files
    let mut files = vec![];
    if let Ok(entries) = std::fs::read_dir(&project_path) {
        for entry in entries.flatten() {
            let metadata = entry.metadata().ok();
            files.push(serde_json::json!({
                "name": entry.file_name().to_string_lossy().to_string(),
                "is_dir": metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
            }));
        }
    }
    
    HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "name": name.as_str(),
            "readme": readme,
            "files": files,
        })),
        error: None,
    })
}

// API: Get principles
#[get("/api/principles")]
async fn get_principles() -> impl Responder {
    let principles_path = PathBuf::from("/home/liam/liminal/PRINCIPLES.md");
    
    match std::fs::read_to_string(principles_path) {
        Ok(content) => HttpResponse::Ok().json(ApiResponse {
            success: true,
            data: Some(serde_json::json!({ "content": content })),
            error: None,
        }),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value> {
            success: false,
            data: None,
            error: Some(format!("Failed to read principles: {}", e)),
        }),
    }
}

// API: Run decision spinner
#[derive(Deserialize)]
struct SpinnerRequest {
    options: Vec<String>,
    mode: String, // random, weighted, elimination, body
}

#[post("/api/spinner/spin")]
async fn spinner_spin(req: web::Json<SpinnerRequest>) -> impl Responder {
    use rand::seq::SliceRandom;
    use rand::Rng;
    
    if req.options.is_empty() {
        return HttpResponse::BadRequest().json(ApiResponse::<serde_json::Value> {
            success: false,
            data: None,
            error: Some("No options provided".to_string()),
        });
    }
    
    let result = match req.mode.as_str() {
        "random" => {
            req.options.choose(&mut rand::thread_rng()).cloned()
        }
        "weighted" => {
            // For now, same as random (weights would need input)
            req.options.choose(&mut rand::thread_rng()).cloned()
        }
        _ => req.options.choose(&mut rand::thread_rng()).cloned(),
    };
    
    HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "result": result,
            "mode": &req.mode,
            "all_options": &req.options,
        })),
        error: None,
    })
}

// API: Get all projects
#[get("/api/projects")]
async fn list_projects() -> impl Responder {
    let projects_dir = PathBuf::from("/home/liam/liminal/projects");
    let mut projects = vec![];
    
    if let Ok(entries) = std::fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().to_string();
                
                // Check for README
                let readme_path = entry.path().join("README.md");
                let has_readme = readme_path.exists();
                
                projects.push(serde_json::json!({
                    "name": name,
                    "has_readme": has_readme,
                }));
            }
        }
    }
    
    HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({ "projects": projects })),
        error: None,
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("🌀 Liminal Server starting on http://localhost:8081");
    
    HttpServer::new(|| {
        App::new()
            .service(index)
            .service(static_files)
            .service(get_project)
            .service(get_principles)
            .service(spinner_spin)
            .service(list_projects)
    })
    .bind("127.0.0.1:8081")?
    .run()
    .await
}
