# Thesis Front-Matter Sections

This document contains the official introductory pages for the project thesis: the **Declaration of Authorship**, the **Vietnamese Summary (Tóm tắt)**, and the **English Abstract**.

---

## 1. DECLARATION OF AUTHORSHIP
*(Lời cam đoan)*

I hereby declare that this thesis, entitled **"Developing an Agentic AI Notetaking System: A Multimodal Personal Knowledge Workspace with Schema-Aware Action Execution"**, is the result of my own independent research and development under the direct guidance and supervision of my advisor, **MSc. Nguyen Dang Quang**. 

All research findings, codebase designs, architectural structures, and evaluation datasets presented in this document are genuine and have not been previously published or submitted for any other degree or qualification at any other institution. All literature sources, external libraries, APIs, and frameworks utilized in the course of this project have been fully referenced, cited, and credited in accordance with standard academic integrity and regulations.

I assume full personal and academic responsibility for the truthfulness, authenticity, and originality of the content presented herein.

**Student Presenter:**  
*Pham Nam Hao*  
Student ID: 22110023  
Faculty of International Education,  
Ho Chi Minh City University of Technology and Education  
*June 2026*

---

## 2. TÓM TẮT DỰ ÁN
*(Vietnamese Summary)*

Sự phân mảnh thông tin và độ trễ tương tác trong các không gian làm việc số hiện nay đang tạo ra những rào cản nhận thức đáng kể đối với người dùng. Các hệ thống quản lý tri thức cá nhân (PKM) truyền thống thường tách rời việc ghi chép văn bản tự do (unstructured notes) khỏi việc quản lý dữ liệu có cấu trúc (structured tables), đồng thời các trợ lý AI tích hợp sẵn đa phần chỉ đóng vai trò phản hồi thụ động dưới dạng chatbot mà thiếu khả năng thao tác trực tiếp lên trạng thái hệ thống. Luận văn này trình bày thiết kế và triển khai của **"Lock In"** – một không gian làm việc số lai ghép toàn diện, tối ưu hóa việc ghi chép thông qua mô hình tương tác hướng ý định (intent-driven) bằng giọng nói với cơ chế bảo mật và kiểm soát chặt chẽ.

Hệ thống được xây dựng trên cấu trúc vi dịch vụ phi trạng thái phân rã:
1. **Frontend và Quản lý Trạng thái UI (Next.js 14 & Zustand)**: Đóng vai trò là cổng giao diện hỗ trợ soạn thảo WYSIWYG (sử dụng Milkdown), ghi âm thời gian thực duy trì liên tục ngay cả khi chuyển đổi thẻ (tab) và cung cấp hệ thống duyệt thư mục phân cấp trực quan với thao tác kéo thả linh hoạt.
2. **Application Server & Data Layer (Node.js BFF, Prisma ORM, PostgreSQL & S3)**: Xử lý xác thực người dùng thông qua NextAuth.js, quản lý lưu trữ siêu dữ liệu (metadata) trên cơ sở dữ liệu Neon serverless PostgreSQL, sử dụng định dạng JSONB để cho phép người dùng tự định nghĩa cột dữ liệu động không cần thay đổi cấu trúc bảng vật lý, và lưu trữ dữ liệu âm thanh trực tiếp trên S3-compatible cloud storage.
3. **AI Microservice Core (Python FastAPI & LangGraph)**: Cách ly và xử lý toàn bộ logic suy luận của các mô hình ngôn ngữ lớn (LLM) thông qua đường ống xử lý dạng đồ thị trạng thái tuần tự và song song. Đồ thị này điều hướng các yêu cầu thông qua Cổng bảo mật (Safety Gate - ngăn chặn prompt injection bằng UUID cryptographic delimiters), Bộ định tuyến độ phức tạp (Complexity Router), các Tác tử chuyên gia song song (Summarize, Task, Calendar, Stack Row), Bộ tổng hợp kế hoạch và kiểm duyệt chất lượng thông qua Vòng phản hồi tự đánh giá (Reflection Node).

Để giải quyết vấn đề ảo tưởng dữ liệu (hallucination) của LLM và bảo mật dữ liệu người dùng, hệ thống triển khai hai cơ chế kỹ thuật cốt lõi: 
* **Dynamic Pydantic Schema Model Compiler**: Biên dịch tự động cấu trúc bảng tùy chỉnh của người dùng thành cấu trúc kiểm định kiểu dữ liệu Pydantic tại thời gian chạy, ép buộc phản hồi cấu trúc JSON đầu ra từ LLM khớp chính xác 100% với kiểu dữ liệu của bảng đích.
* **Human-in-the-Loop Confirmation Gate**: Tất cả các đề xuất đột biến dữ liệu của AI (cập nhật văn bản ghi chú dạng trực quan hóa diff đỏ/xanh, thêm hàng dữ liệu "mờ" (ghost row) hay tạo công việc/lịch hẹn) chỉ được lưu vào cơ sở dữ liệu khi có sự xác nhận chấp thuận rõ ràng của người dùng thông qua Zustand staging buffer, ngăn chặn hoàn toàn việc ghi sai dữ liệu của AI.

Kết quả thực nghiệm cho thấy hệ thống đạt độ tin cậy tuyệt đối về mặt kiểu dữ liệu đối với các truy vấn bảng, đồng thời đáp ứng trọn vẹn giới hạn SLA (Service Level Agreement) xử lý giọng nói tích hợp thời gian thực kết hợp giữa Deepgram Nova-3 và Gemini 2.5 Flash dưới mức $\le$ 4.0 giây cho toàn bộ vòng đời lệnh gọi. Luận văn chứng minh tính khả thi của việc xây dựng một hệ thống PKM agentic hiệu năng cao, trực quan, bảo mật cao và hướng người dùng.

---

## 3. ABSTRACT

The fragmentation of digital workspaces and interactive latency pose significant cognitive penalties in personal knowledge management (PKM). Traditional platforms separate free-form textual ideation (unstructured notes) from relational database sheets (structured tables), while current AI assistants remain confined to passive, conversational chat boxes lacking the ability to manipulate application states directly. This thesis presents the design and implementation of **"Lock In"**—a full-stack, multimodal knowledge workspace that unifies notes and spreadsheets under a voice-driven, intent-driven agentic interface while maintaining strict security boundaries and data integrity.

The system is designed around a decoupled microservice architecture:
1. **Frontend & Client-Side State (Next.js 14 & Zustand)**: Powers the user workspace shell, utilizing a WYSIWYG editor (Milkdown core), a drag-and-drop hierarchical sidebar explorer, and a robust push-to-talk background recorder that captures microphone inputs persistently across workspace views.
2. **Application Server & Persistence Gateway (Node.js BFF, Prisma ORM, PostgreSQL & S3)**: Manages authentication, mediates relational database queries, utilizes PostgreSQL JSONB structures to allow end-users to dynamically build custom database columns without schema migrations, and uploads audio binary streams directly to S3-compatible object storage via presigned URLs.
3. **Agentic AI Reasoning Engine (Python FastAPI & LangGraph)**: Isolates Large Language Model (LLM) calls behind an asynchronous microservice. AI orchestration is modeled as a compiled stateful directed graph (StateGraph) including a Sentinel Safety Gate (neutralizing prompt injections using randomized cryptographic UUID delimiters), a Complexity Router, parallel expert extraction agents (Notes, Tasks, Calendar, and Stack columns), a Planner, and a self-correcting Reflection Node to audit execution quality.

To address LLM data hallucinations and ensure user data sovereignty, the system introduces two primary engineering contributions:
* **Dynamic Pydantic Schema Model Compiler**: Translates user-defined database schemas dynamically at runtime into structured Pydantic validator models, forcing LLM outputs into strictly typed JSON structures matching the destination columns.
* **Human-in-the-Loop Confirmation Gate**: AI-generated actions are held in a Zustand staging buffer and visually projected in the UI (as red/green text diffs or highlighted "ghost rows" in spreadsheets) as proposals. No writes or mutations are committed to the primary database until the user explicitly accepts them.

Empirical evaluation indicates that the workspace achieves 100% data type safety during structured database insertion while satisfying an end-to-end roundtrip voice command latency SLA of $\le$ 4.0 seconds combining Deepgram Nova-3 and Google Gemini 2.5 Flash. This project demonstrates the feasibility of combining unstructured and structured data systems under a highly responsive, voice-driven, and structurally safe agentic workspace.
