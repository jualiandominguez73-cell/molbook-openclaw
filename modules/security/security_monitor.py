#!/usr/bin/env python3
"""
OpenClaw Security Monitoring & Vulnerability Scanner
====================================================

Comprehensive security monitoring system that:
- Scans for vulnerabilities
- Monitors security logs
- Detects threats
- Generates security reports

Usage:
    python3 security_monitor.py --scan
    python3 security_monitor.py --monitor
    python3 security_monitor.py --report
"""

import json
import os
import sys
import subprocess
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import argparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SecurityMonitor:
    """Comprehensive security monitoring and vulnerability scanning"""
    
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or Path("security-config.json")
        self.config = self._load_config()
        self.openclaw_dir = Path.home() / ".openclaw"
        self.logs_dir = self.openclaw_dir / "logs" / "security"
        self.reports_dir = self.openclaw_dir / "reports" / "security"
        
        # Create directories
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.reports_dir.mkdir(parents=True, exist_ok=True)
    
    def _load_config(self) -> Dict:
        """Load security configuration"""
        if not self.config_path.exists():
            logger.warning(f"Config not found: {self.config_path}, using defaults")
            return {}
        
        with open(self.config_path) as f:
            return json.load(f)
    
    def scan_dependencies(self) -> Dict:
        """Scan Python dependencies for known vulnerabilities"""
        logger.info("Scanning dependencies for vulnerabilities...")
        
        results = {
            "timestamp": datetime.now().isoformat(),
            "vulnerabilities": [],
            "total_packages": 0,
            "vulnerable_packages": 0
        }
        
        try:
            # Check if safety is installed
            try:
                import safety
            except ImportError:
                logger.warning("Installing safety scanner...")
                subprocess.run([
                    sys.executable, "-m", "pip", "install",
                    "safety", "--break-system-packages", "-q"
                ], check=True)
            
            # Run safety check
            result = subprocess.run(
                [sys.executable, "-m", "safety", "check", "--json"],
                capture_output=True,
                text=True
            )
            
            if result.stdout:
                safety_results = json.loads(result.stdout)
                
                for vuln in safety_results:
                    vulnerability = {
                        "package": vuln.get("package"),
                        "version": vuln.get("installed_version"),
                        "vulnerability_id": vuln.get("vulnerability_id"),
                        "severity": vuln.get("severity", "unknown"),
                        "description": vuln.get("advisory"),
                        "fixed_in": vuln.get("fixed_in", [])
                    }
                    results["vulnerabilities"].append(vulnerability)
                
                results["vulnerable_packages"] = len(safety_results)
            
            # Count total packages
            pip_list = subprocess.run(
                [sys.executable, "-m", "pip", "list", "--format=json"],
                capture_output=True,
                text=True
            )
            
            if pip_list.stdout:
                packages = json.loads(pip_list.stdout)
                results["total_packages"] = len(packages)
            
            logger.info(f"Found {results['vulnerable_packages']} vulnerable packages")
            
        except Exception as e:
            logger.error(f"Dependency scanning failed: {e}")
            results["error"] = str(e)
        
        return results
    
    def scan_configuration(self) -> Dict:
        """Scan for configuration security issues"""
        logger.info("Scanning configuration for security issues...")
        
        issues = []
        
        # Check for plaintext credentials
        config_files = [
            self.openclaw_dir / "config.json",
            self.openclaw_dir / ".env",
            Path.home() / ".bashrc",
            Path.home() / ".bash_profile"
        ]
        
        for config_file in config_files:
            if not config_file.exists():
                continue
            
            try:
                content = config_file.read_text()
                
                # Check for API keys in plaintext
                sensitive_patterns = [
                    "api_key", "apikey", "api-key",
                    "token", "password", "secret",
                    "sk-", "Bearer "
                ]
                
                for pattern in sensitive_patterns:
                    if pattern in content.lower():
                        issues.append({
                            "severity": "high",
                            "type": "credential_exposure",
                            "file": str(config_file),
                            "issue": f"Possible plaintext credential: {pattern}",
                            "recommendation": "Move to OS keychain"
                        })
                
            except Exception as e:
                logger.debug(f"Could not scan {config_file}: {e}")
        
        # Check file permissions
        sensitive_files = [
            self.openclaw_dir / "config.json",
            self.openclaw_dir / "vault.db",
            self.openclaw_dir / "master.key"
        ]
        
        for file_path in sensitive_files:
            if not file_path.exists():
                continue
            
            stat_info = file_path.stat()
            mode = oct(stat_info.st_mode)[-3:]
            
            if mode != "600":
                issues.append({
                    "severity": "medium",
                    "type": "insecure_permissions",
                    "file": str(file_path),
                    "current_permissions": mode,
                    "issue": f"File has insecure permissions: {mode}",
                    "recommendation": "Set to 600 (owner read/write only)"
                })
        
        # Check for default passwords
        if self.openclaw_dir.exists():
            for file_path in self.openclaw_dir.rglob("*.json"):
                try:
                    with open(file_path) as f:
                        data = json.load(f)
                        
                    if isinstance(data, dict):
                        for key, value in data.items():
                            if isinstance(value, str):
                                if value in ["password", "changeme", "default", "admin", "12345"]:
                                    issues.append({
                                        "severity": "critical",
                                        "type": "default_password",
                                        "file": str(file_path),
                                        "issue": "Default password detected",
                                        "recommendation": "Change to strong password immediately"
                                    })
                except:
                    pass
        
        return {
            "timestamp": datetime.now().isoformat(),
            "issues_found": len(issues),
            "issues": issues
        }
    
    def scan_network(self) -> Dict:
        """Scan for suspicious network connections"""
        logger.info("Scanning network connections...")
        
        results = {
            "timestamp": datetime.now().isoformat(),
            "suspicious_connections": []
        }
        
        try:
            # Get active network connections
            if sys.platform == "darwin":
                cmd = ["lsof", "-i", "-P", "-n"]
            elif sys.platform.startswith("linux"):
                cmd = ["ss", "-tuln"]
            else:
                logger.warning(f"Network scanning not supported on {sys.platform}")
                return results
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                
                # Look for suspicious patterns
                suspicious_ports = [8080, 3000, 5000, 6666, 31337]
                
                for line in lines:
                    for port in suspicious_ports:
                        if str(port) in line:
                            results["suspicious_connections"].append({
                                "connection": line.strip(),
                                "reason": f"Suspicious port: {port}",
                                "severity": "medium"
                            })
            
        except Exception as e:
            logger.error(f"Network scanning failed: {e}")
            results["error"] = str(e)
        
        return results
    
    def check_security_logs(self) -> Dict:
        """Check security logs for incidents"""
        logger.info("Checking security logs...")
        
        results = {
            "timestamp": datetime.now().isoformat(),
            "failed_auth_attempts": 0,
            "blocked_requests": 0,
            "errors": 0,
            "recent_incidents": []
        }
        
        # Check various log files
        log_files = [
            self.logs_dir / "security.log",
            self.logs_dir / "audit.log",
            self.openclaw_dir / "logs" / "application.log"
        ]
        
        for log_file in log_files:
            if not log_file.exists():
                continue
            
            try:
                # Read last 1000 lines
                with open(log_file) as f:
                    lines = f.readlines()[-1000:]
                
                for line in lines:
                    lower_line = line.lower()
                    
                    if "failed" in lower_line and "auth" in lower_line:
                        results["failed_auth_attempts"] += 1
                    
                    if "blocked" in lower_line or "denied" in lower_line:
                        results["blocked_requests"] += 1
                    
                    if "error" in lower_line or "exception" in lower_line:
                        results["errors"] += 1
                    
                    # Look for specific security events
                    if any(word in lower_line for word in ["attack", "injection", "malware", "breach"]):
                        results["recent_incidents"].append({
                            "log_file": str(log_file),
                            "line": line.strip()[:200],
                            "severity": "high"
                        })
            
            except Exception as e:
                logger.debug(f"Could not read log {log_file}: {e}")
        
        return results
    
    def generate_report(self) -> Dict:
        """Generate comprehensive security report"""
        logger.info("Generating security report...")
        
        report = {
            "generated_at": datetime.now().isoformat(),
            "dependency_scan": self.scan_dependencies(),
            "configuration_scan": self.scan_configuration(),
            "network_scan": self.scan_network(),
            "log_analysis": self.check_security_logs()
        }
        
        # Calculate overall security score
        score = 100
        
        # Deduct for vulnerabilities
        vuln_count = report["dependency_scan"].get("vulnerable_packages", 0)
        score -= min(vuln_count * 5, 30)
        
        # Deduct for configuration issues
        config_issues = report["configuration_scan"].get("issues_found", 0)
        score -= min(config_issues * 10, 40)
        
        # Deduct for security incidents
        incidents = len(report["log_analysis"].get("recent_incidents", []))
        score -= min(incidents * 15, 30)
        
        report["security_score"] = max(score, 0)
        
        # Determine overall status
        if score >= 90:
            report["status"] = "excellent"
        elif score >= 70:
            report["status"] = "good"
        elif score >= 50:
            report["status"] = "fair"
        else:
            report["status"] = "poor"
        
        # Save report
        report_file = self.reports_dir / f"security_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Report saved to: {report_file}")
        
        return report
    
    def print_report(self, report: Dict):
        """Print formatted security report"""
        print("\n" + "=" * 70)
        print("OpenClaw Security Report")
        print("=" * 70)
        print(f"\nGenerated: {report['generated_at']}")
        print(f"Security Score: {report['security_score']}/100 ({report['status'].upper()})")
        
        # Dependency scan
        dep_scan = report["dependency_scan"]
        print(f"\n📦 Dependency Scan:")
        print(f"   Total packages: {dep_scan.get('total_packages', 0)}")
        print(f"   Vulnerable: {dep_scan.get('vulnerable_packages', 0)}")
        
        if dep_scan.get("vulnerabilities"):
            print(f"\n   ⚠️  Vulnerabilities found:")
            for vuln in dep_scan["vulnerabilities"][:5]:
                print(f"      • {vuln['package']} ({vuln['severity']}): {vuln.get('vulnerability_id', 'N/A')}")
        
        # Configuration scan
        config_scan = report["configuration_scan"]
        print(f"\n⚙️  Configuration Scan:")
        print(f"   Issues found: {config_scan.get('issues_found', 0)}")
        
        if config_scan.get("issues"):
            for issue in config_scan["issues"][:5]:
                print(f"      • [{issue['severity'].upper()}] {issue['issue']}")
        
        # Log analysis
        log_analysis = report["log_analysis"]
        print(f"\n📋 Log Analysis:")
        print(f"   Failed auth attempts: {log_analysis.get('failed_auth_attempts', 0)}")
        print(f"   Blocked requests: {log_analysis.get('blocked_requests', 0)}")
        print(f"   Errors: {log_analysis.get('errors', 0)}")
        
        if log_analysis.get("recent_incidents"):
            print(f"\n   🚨 Recent incidents: {len(log_analysis['recent_incidents'])}")
        
        # Network scan
        network_scan = report["network_scan"]
        if network_scan.get("suspicious_connections"):
            print(f"\n🌐 Network Scan:")
            print(f"   Suspicious connections: {len(network_scan['suspicious_connections'])}")
        
        print("\n" + "=" * 70)
        
        # Recommendations
        if report["security_score"] < 70:
            print("\n⚠️  RECOMMENDATIONS:")
            if dep_scan.get("vulnerable_packages", 0) > 0:
                print("   1. Update vulnerable dependencies: pip install --upgrade <package>")
            if config_scan.get("issues_found", 0) > 0:
                print("   2. Fix configuration issues (see above)")
            if log_analysis.get("failed_auth_attempts", 0) > 5:
                print("   3. Investigate failed authentication attempts")
            print()

def main():
    parser = argparse.ArgumentParser(description="OpenClaw Security Monitor")
    parser.add_argument("--scan", action="store_true", help="Run vulnerability scan")
    parser.add_argument("--monitor", action="store_true", help="Monitor security logs")
    parser.add_argument("--report", action="store_true", help="Generate security report")
    parser.add_argument("--config", type=Path, help="Path to security config file")
    
    args = parser.parse_args()
    
    monitor = SecurityMonitor(config_path=args.config)
    
    if args.scan:
        print("Running dependency scan...")
        results = monitor.scan_dependencies()
        print(f"\nFound {results['vulnerable_packages']} vulnerable packages")
        
        print("\nRunning configuration scan...")
        config_results = monitor.scan_configuration()
        print(f"Found {config_results['issues_found']} configuration issues")
    
    elif args.monitor:
        print("Monitoring security logs...")
        results = monitor.check_security_logs()
        print(f"\nFailed auth attempts: {results['failed_auth_attempts']}")
        print(f"Blocked requests: {results['blocked_requests']}")
        print(f"Errors: {results['errors']}")
        
        if results['recent_incidents']:
            print(f"\n⚠️  {len(results['recent_incidents'])} security incidents detected!")
    
    elif args.report:
        report = monitor.generate_report()
        monitor.print_report(report)
    
    else:
        # Run full scan by default
        report = monitor.generate_report()
        monitor.print_report(report)

if __name__ == "__main__":
    main()
