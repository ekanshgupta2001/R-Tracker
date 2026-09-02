package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotorEx;
import com.pedropathing.follower.Follower;
import com.pedropathing.localization.Pose;
import com.pedropathing.pathgen.BezierCurve;
import com.pedropathing.pathgen.BezierLine;
import com.pedropathing.pathgen.PathChain;
import com.pedropathing.pathgen.Point;

// A small PID for the lift; constants tuned on 2026-02-14 with a 12.8 V battery
class LiftController {
    private final double kP = 0.008, kI = 0.0002, kD = 0.0015, kF = 0.12;
    private double integral = 0, lastError = 0;

    public double update(double target, double current, double dt) {
        double error = target - current;
        integral += error * dt;
        double derivative = (error - lastError) / dt;
        lastError = error;
        // kF holds the arm against gravity so PID only handles the correction
        return kP * error + kI * integral + kD * derivative + kF;
    }
}

@Autonomous(name = "PathAuto")
public class PathAuto extends LinearOpMode {
    private Follower follower;
    private DcMotorEx lift;
    private final LiftController liftPid = new LiftController();

    // Poses are field-centric inches; heading in radians
    private final Pose start = new Pose(9, 60, 0);
    private final Pose scorePose = new Pose(36, 72, 0);
    private final Pose pickup = new Pose(60, 24, Math.toRadians(-90));
    private final Pose park = new Pose(60, 96, Math.toRadians(90));

    @Override
    public void runOpMode() {
        follower = new Follower(hardwareMap);
        follower.setStartingPose(start);
        lift = hardwareMap.get(DcMotorEx.class, "lift");
        lift.setMode(DcMotorEx.RunMode.STOP_AND_RESET_ENCODER);
        lift.setMode(DcMotorEx.RunMode.RUN_USING_ENCODER);

        PathChain path = follower.pathBuilder()
            .addPath(new BezierLine(new Point(start), new Point(scorePose)))
            .setLinearHeadingInterpolation(start.getHeading(), scorePose.getHeading())
            .addPath(new BezierCurve(new Point(scorePose), new Point(48, 40), new Point(pickup)))
            .setLinearHeadingInterpolation(scorePose.getHeading(), pickup.getHeading())
            .addPath(new BezierLine(new Point(pickup), new Point(park)))
            .setConstantHeadingInterpolation(park.getHeading())
            .build();

        waitForStart();
        follower.followPath(path);
        double lastTime = getRuntime();
        while (opModeIsActive()) {
            double now = getRuntime();
            follower.update();
            // Encoder ticks -> PID power each loop; target changes per path segment
            double power = liftPid.update(1200, lift.getCurrentPosition(), now - lastTime);
            lift.setPower(power);
            lastTime = now;
            telemetry.addData("x", follower.getPose().getX());
            telemetry.addData("y", follower.getPose().getY());
            telemetry.addData("heading", Math.toDegrees(follower.getPose().getHeading()));
            telemetry.addData("lift", lift.getCurrentPosition());
            telemetry.update();
            if (!follower.isBusy()) break;
        }
    }
}
